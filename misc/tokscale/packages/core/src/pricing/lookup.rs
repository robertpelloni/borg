use super::{aliases, litellm::ModelPricing};
use std::collections::HashMap;
use std::sync::RwLock;

const PROVIDER_PREFIXES: &[&str] = &[
    "openai/",
    "anthropic/",
    "google/",
    "meta-llama/",
    "mistralai/",
    "deepseek/",
    "qwen/",
    "cohere/",
    "perplexity/",
    "x-ai/",
];

const ORIGINAL_PROVIDER_PREFIXES: &[&str] = &[
    "x-ai/",
    "xai/",
    "anthropic/",
    "openai/",
    "google/",
    "meta-llama/",
    "mistralai/",
    "deepseek/",
    "z-ai/",
    "qwen/",
    "cohere/",
    "perplexity/",
    "moonshotai/",
];

const RESELLER_PROVIDER_PREFIXES: &[&str] = &[
    "azure/",
    "azure_ai/",
    "bedrock/",
    "vertex_ai/",
    "together/",
    "together_ai/",
    "fireworks_ai/",
    "groq/",
    "openrouter/",
];

const FUZZY_BLOCKLIST: &[&str] = &["auto", "mini", "chat", "base"];

const MIN_FUZZY_MATCH_LEN: usize = 5;

/// Quality/speed tier suffixes that should be stripped for pricing lookup
/// These indicate provider-specific routing but don't affect the base model pricing
/// Note: OpenCode Zen uses -xhigh suffix for extra-high quality tier
const TIER_SUFFIXES: &[&str] = &[
    "-xhigh", "-low", "-high", "-medium", "-free", ":low", ":high", ":medium", ":free",
];

/// Routing/quota prefixes that should be stripped for pricing lookup.
/// These indicate third-party routing systems (e.g., antigravity-auth plugin) but don't affect base model pricing.
/// Configurable: Add new prefixes here as they emerge from community plugins.
const STRIPPED_PREFIXES: &[&str] = &["antigravity-"];

/// Model variant suffixes that can be stripped as a fallback when pricing isn't found.
/// These represent model variants that typically share pricing with their base model.
/// Order matters: suffixes are tried in order, and only the first match is used.
const FALLBACK_SUFFIXES: &[&str] = &["-codex", "-codex-max"];

#[derive(Clone)]
struct CachedResult {
    pricing: ModelPricing,
    source: String,
    matched_key: String,
}

pub struct PricingLookup {
    litellm: HashMap<String, ModelPricing>,
    openrouter: HashMap<String, ModelPricing>,
    litellm_keys: Vec<String>,
    openrouter_keys: Vec<String>,
    litellm_lower: HashMap<String, String>,
    openrouter_lower: HashMap<String, String>,
    openrouter_model_part: HashMap<String, String>,
    lookup_cache: RwLock<HashMap<String, Option<CachedResult>>>,
}

pub struct LookupResult {
    pub pricing: ModelPricing,
    pub source: String,
    pub matched_key: String,
}

impl PricingLookup {
    pub fn new(
        litellm: HashMap<String, ModelPricing>,
        openrouter: HashMap<String, ModelPricing>,
    ) -> Self {
        let mut litellm_keys: Vec<String> = litellm.keys().cloned().collect();
        litellm_keys.sort_by(|a, b| b.len().cmp(&a.len()));

        let mut openrouter_keys: Vec<String> = openrouter.keys().cloned().collect();
        openrouter_keys.sort_by(|a, b| b.len().cmp(&a.len()));

        let mut litellm_lower = HashMap::with_capacity(litellm.len());
        for key in &litellm_keys {
            litellm_lower.insert(key.to_lowercase(), key.clone());
        }

        let mut openrouter_lower = HashMap::with_capacity(openrouter.len());
        let mut openrouter_model_part = HashMap::with_capacity(openrouter.len());
        for key in &openrouter_keys {
            let lower = key.to_lowercase();
            openrouter_lower.insert(lower.clone(), key.clone());
            if let Some(model_part) = lower.split('/').last() {
                if model_part != lower {
                    openrouter_model_part.insert(model_part.to_string(), key.clone());
                }
            }
        }

        Self {
            litellm,
            openrouter,
            litellm_keys,
            openrouter_keys,
            litellm_lower,
            openrouter_lower,
            openrouter_model_part,
            lookup_cache: RwLock::new(HashMap::with_capacity(64)),
        }
    }

    pub fn lookup(&self, model_id: &str) -> Option<LookupResult> {
        if let Some(cached) = self
            .lookup_cache
            .read()
            .ok()
            .and_then(|c| c.get(model_id).cloned())
        {
            return cached.map(|c| LookupResult {
                pricing: c.pricing,
                source: c.source,
                matched_key: c.matched_key,
            });
        }

        let result = self.lookup_with_source(model_id, None);

        if let Ok(mut cache) = self.lookup_cache.write() {
            cache.insert(
                model_id.to_string(),
                result.as_ref().map(|r| CachedResult {
                    pricing: r.pricing.clone(),
                    source: r.source.clone(),
                    matched_key: r.matched_key.clone(),
                }),
            );
        }

        result
    }

    pub fn lookup_with_source(
        &self,
        model_id: &str,
        force_source: Option<&str>,
    ) -> Option<LookupResult> {
        let prefix_stripped = strip_routing_prefix(model_id);
        let canonical = aliases::resolve_alias(prefix_stripped).unwrap_or(prefix_stripped);
        let lower = canonical.to_lowercase();

        // Helper to perform lookup with the given source constraint
        let do_lookup = |id: &str| match force_source {
            Some("litellm") => self.lookup_litellm_only(id),
            Some("openrouter") => self.lookup_openrouter_only(id),
            _ => self.lookup_auto(id),
        };

        // Try direct lookup
        if let Some(result) = do_lookup(&lower) {
            return Some(result);
        }

        // Try stripping tier suffix (e.g., -high, -low)
        if let Some(tier_stripped) = strip_tier_suffix(&lower) {
            if let Some(result) = do_lookup(tier_stripped) {
                return Some(result);
            }
            // Try fallback suffix on the tier-stripped version (e.g., gpt-5-codex-high -> gpt-5-codex -> gpt-5)
            if let Some(fallback_stripped) = strip_fallback_suffix(tier_stripped) {
                if let Some(result) = do_lookup(fallback_stripped) {
                    return Some(result);
                }
            }
        }

        // Try stripping fallback suffixes (e.g., -codex variants falling back to base model)
        if let Some(fallback_stripped) = strip_fallback_suffix(&lower) {
            if let Some(result) = do_lookup(fallback_stripped) {
                return Some(result);
            }
            // Also try tier suffix on the fallback-stripped version
            if let Some(tier_stripped) = strip_tier_suffix(fallback_stripped) {
                if let Some(result) = do_lookup(tier_stripped) {
                    return Some(result);
                }
            }
        }

        None
    }

    fn lookup_auto(&self, model_id: &str) -> Option<LookupResult> {
        if let Some(result) = self.exact_match_litellm(model_id) {
            return Some(result);
        }

        if let Some(result) = self.exact_match_openrouter(model_id) {
            return Some(result);
        }

        if let Some(version_normalized) = normalize_version_separator(model_id) {
            if let Some(result) = self.exact_match_litellm(&version_normalized) {
                return Some(result);
            }
            if let Some(result) = self.exact_match_openrouter(&version_normalized) {
                return Some(result);
            }
        }

        if let Some(normalized) = normalize_model_name(model_id) {
            if let Some(result) = self.exact_match_litellm(&normalized) {
                return Some(result);
            }
            if let Some(result) = self.exact_match_openrouter(&normalized) {
                return Some(result);
            }
        }

        if let Some(result) = self.prefix_match_litellm(model_id) {
            return Some(result);
        }
        if let Some(result) = self.prefix_match_openrouter(model_id) {
            return Some(result);
        }

        if let Some(version_normalized) = normalize_version_separator(model_id) {
            if let Some(result) = self.prefix_match_litellm(&version_normalized) {
                return Some(result);
            }
            if let Some(result) = self.prefix_match_openrouter(&version_normalized) {
                return Some(result);
            }
        }

        if !is_fuzzy_eligible(model_id) {
            return None;
        }

        let litellm_result = self.fuzzy_match_litellm(model_id);
        let openrouter_result = self.fuzzy_match_openrouter(model_id);

        match (&litellm_result, &openrouter_result) {
            (Some(l), Some(o)) => {
                let l_is_original = is_original_provider(&l.matched_key);
                let o_is_original = is_original_provider(&o.matched_key);
                let l_is_reseller = is_reseller_provider(&l.matched_key);
                let o_is_reseller = is_reseller_provider(&o.matched_key);

                if o_is_original && !l_is_original {
                    return openrouter_result;
                }
                if l_is_original && !o_is_original {
                    return litellm_result;
                }
                if !l_is_reseller && o_is_reseller {
                    return litellm_result;
                }
                if !o_is_reseller && l_is_reseller {
                    return openrouter_result;
                }
                litellm_result
            }
            (Some(_), None) => litellm_result,
            (None, Some(_)) => openrouter_result,
            (None, None) => None,
        }
    }

    fn lookup_litellm_only(&self, model_id: &str) -> Option<LookupResult> {
        if let Some(result) = self.exact_match_litellm(model_id) {
            return Some(result);
        }
        if let Some(version_normalized) = normalize_version_separator(model_id) {
            if let Some(result) = self.exact_match_litellm(&version_normalized) {
                return Some(result);
            }
        }
        if let Some(normalized) = normalize_model_name(model_id) {
            if let Some(result) = self.exact_match_litellm(&normalized) {
                return Some(result);
            }
        }
        if let Some(result) = self.prefix_match_litellm(model_id) {
            return Some(result);
        }
        if let Some(version_normalized) = normalize_version_separator(model_id) {
            if let Some(result) = self.prefix_match_litellm(&version_normalized) {
                return Some(result);
            }
        }
        if is_fuzzy_eligible(model_id) {
            if let Some(result) = self.fuzzy_match_litellm(model_id) {
                return Some(result);
            }
        }
        None
    }

    fn lookup_openrouter_only(&self, model_id: &str) -> Option<LookupResult> {
        if let Some(result) = self.exact_match_openrouter(model_id) {
            return Some(result);
        }
        if let Some(version_normalized) = normalize_version_separator(model_id) {
            if let Some(result) = self.exact_match_openrouter(&version_normalized) {
                return Some(result);
            }
        }
        if let Some(normalized) = normalize_model_name(model_id) {
            if let Some(result) = self.exact_match_openrouter(&normalized) {
                return Some(result);
            }
        }
        if let Some(result) = self.prefix_match_openrouter(model_id) {
            return Some(result);
        }
        if let Some(version_normalized) = normalize_version_separator(model_id) {
            if let Some(result) = self.prefix_match_openrouter(&version_normalized) {
                return Some(result);
            }
        }
        if is_fuzzy_eligible(model_id) {
            if let Some(result) = self.fuzzy_match_openrouter(model_id) {
                return Some(result);
            }
        }
        None
    }

    fn exact_match_litellm(&self, model_id: &str) -> Option<LookupResult> {
        if let Some(key) = self.litellm_lower.get(model_id) {
            return Some(LookupResult {
                pricing: self.litellm.get(key).unwrap().clone(),
                source: "LiteLLM".into(),
                matched_key: key.clone(),
            });
        }
        None
    }

    fn exact_match_openrouter(&self, model_id: &str) -> Option<LookupResult> {
        if let Some(key) = self.openrouter_lower.get(model_id) {
            return Some(LookupResult {
                pricing: self.openrouter.get(key).unwrap().clone(),
                source: "OpenRouter".into(),
                matched_key: key.clone(),
            });
        }
        if let Some(key) = self.openrouter_model_part.get(model_id) {
            return Some(LookupResult {
                pricing: self.openrouter.get(key).unwrap().clone(),
                source: "OpenRouter".into(),
                matched_key: key.clone(),
            });
        }
        None
    }

    fn prefix_match_litellm(&self, model_id: &str) -> Option<LookupResult> {
        for prefix in PROVIDER_PREFIXES {
            let key = format!("{}{}", prefix, model_id);
            if let Some(litellm_key) = self.litellm_lower.get(&key) {
                return Some(LookupResult {
                    pricing: self.litellm.get(litellm_key).unwrap().clone(),
                    source: "LiteLLM".into(),
                    matched_key: litellm_key.clone(),
                });
            }
        }
        None
    }

    fn prefix_match_openrouter(&self, model_id: &str) -> Option<LookupResult> {
        for prefix in PROVIDER_PREFIXES {
            let key = format!("{}{}", prefix, model_id);
            if let Some(or_key) = self.openrouter_lower.get(&key) {
                return Some(LookupResult {
                    pricing: self.openrouter.get(or_key).unwrap().clone(),
                    source: "OpenRouter".into(),
                    matched_key: or_key.clone(),
                });
            }
        }
        None
    }

    fn fuzzy_match_litellm(&self, model_id: &str) -> Option<LookupResult> {
        let family = extract_model_family(model_id);
        let mut family_matches_list: Vec<&String> = Vec::new();

        for key in &self.litellm_keys {
            let lower_key = key.to_lowercase();
            if family_matches(&lower_key, &family) && contains_model_id(&lower_key, model_id) {
                family_matches_list.push(key);
            }
        }

        if let Some(result) = select_best_match(&family_matches_list, &self.litellm, "LiteLLM") {
            return Some(result);
        }

        let mut all_matches: Vec<&String> = Vec::new();
        for key in &self.litellm_keys {
            let lower_key = key.to_lowercase();
            if contains_model_id(&lower_key, model_id) {
                all_matches.push(key);
            }
        }

        select_best_match(&all_matches, &self.litellm, "LiteLLM")
    }

    fn fuzzy_match_openrouter(&self, model_id: &str) -> Option<LookupResult> {
        let family = extract_model_family(model_id);
        let mut family_matches_list: Vec<&String> = Vec::new();

        for key in &self.openrouter_keys {
            let lower_key = key.to_lowercase();
            let model_part = lower_key.split('/').last().unwrap_or(&lower_key);
            if family_matches(model_part, &family) && contains_model_id(model_part, model_id) {
                family_matches_list.push(key);
            }
        }

        if let Some(result) =
            select_best_match(&family_matches_list, &self.openrouter, "OpenRouter")
        {
            return Some(result);
        }

        let mut all_matches: Vec<&String> = Vec::new();
        for key in &self.openrouter_keys {
            let lower_key = key.to_lowercase();
            let model_part = lower_key.split('/').last().unwrap_or(&lower_key);
            if contains_model_id(model_part, model_id) {
                all_matches.push(key);
            }
        }

        select_best_match(&all_matches, &self.openrouter, "OpenRouter")
    }

    pub fn calculate_cost(
        &self,
        model_id: &str,
        input: i64,
        output: i64,
        cache_read: i64,
        cache_write: i64,
        reasoning: i64,
    ) -> f64 {
        let result = match self.lookup(model_id) {
            Some(r) => r,
            None => return 0.0,
        };

        let p = &result.pricing;
        let safe_price =
            |opt: Option<f64>| opt.filter(|v| v.is_finite() && *v >= 0.0).unwrap_or(0.0);

        let input_cost = input as f64 * safe_price(p.input_cost_per_token);
        let output_cost = (output + reasoning) as f64 * safe_price(p.output_cost_per_token);
        let cache_read_cost = cache_read as f64 * safe_price(p.cache_read_input_token_cost);
        let cache_write_cost = cache_write as f64 * safe_price(p.cache_creation_input_token_cost);

        input_cost + output_cost + cache_read_cost + cache_write_cost
    }
}

fn extract_model_family(model_id: &str) -> String {
    let lower = model_id.to_lowercase();

    if lower.contains("gpt-5") {
        return "gpt-5".into();
    }
    if lower.contains("gpt-4.1") {
        return "gpt-4.1".into();
    }
    if lower.contains("gpt-4o") {
        return "gpt-4o".into();
    }
    if lower.contains("gpt-4") {
        return "gpt-4".into();
    }
    if lower.contains("o3") {
        return "o3".into();
    }
    if lower.contains("o4") {
        return "o4".into();
    }

    if lower.contains("opus") {
        return "opus".into();
    }
    if lower.contains("sonnet") {
        return "sonnet".into();
    }
    if lower.contains("haiku") {
        return "haiku".into();
    }
    if lower.contains("claude") {
        return "claude".into();
    }

    if lower.contains("gemini-3") {
        return "gemini-3".into();
    }
    if lower.contains("gemini-2.5") {
        return "gemini-2.5".into();
    }
    if lower.contains("gemini-2") {
        return "gemini-2".into();
    }
    if lower.contains("gemini") {
        return "gemini".into();
    }

    if lower.contains("llama") {
        return "llama".into();
    }
    if lower.contains("mistral") {
        return "mistral".into();
    }
    if lower.contains("deepseek") {
        return "deepseek".into();
    }
    if lower.contains("qwen") {
        return "qwen".into();
    }

    lower
        .split(|c: char| c == '-' || c == '_' || c == '.')
        .next()
        .unwrap_or(&lower)
        .to_string()
}

fn family_matches(key: &str, family: &str) -> bool {
    if family.is_empty() {
        return true;
    }
    key.contains(family)
}

fn contains_model_id(key: &str, model_id: &str) -> bool {
    if let Some(pos) = key.find(model_id) {
        let before_ok = pos == 0 || !key[..pos].chars().last().unwrap().is_alphanumeric();
        let after_pos = pos + model_id.len();
        let after_ok =
            after_pos == key.len() || !key[after_pos..].chars().next().unwrap().is_alphanumeric();
        before_ok && after_ok
    } else {
        false
    }
}

fn normalize_model_name(model_id: &str) -> Option<String> {
    let lower = model_id.to_lowercase();

    if lower.contains("opus") {
        if lower.contains("4.5") || lower.contains("4-5") {
            return Some("claude-opus-4-5".into());
        } else if lower.contains("4") {
            return Some("claude-opus-4".into());
        }
    }
    if lower.contains("sonnet") {
        if lower.contains("4.5") || lower.contains("4-5") {
            return Some("claude-sonnet-4-5".into());
        } else if lower.contains("4") && !lower.contains("3.") && !lower.contains("3-") {
            return Some("claude-sonnet-4".into());
        } else if lower.contains("3.7") || lower.contains("3-7") {
            return Some("claude-3-7-sonnet".into());
        } else if lower.contains("3.5") || lower.contains("3-5") {
            return Some("claude-3.5-sonnet".into());
        }
    }
    if lower.contains("haiku") {
        if lower.contains("4.5") || lower.contains("4-5") {
            return Some("claude-haiku-4-5".into());
        } else if lower.contains("3.5") || lower.contains("3-5") {
            return Some("claude-3.5-haiku".into());
        }
    }

    None
}

fn normalize_version_separator(model_id: &str) -> Option<String> {
    let mut result = String::with_capacity(model_id.len());
    let chars: Vec<char> = model_id.chars().collect();
    let mut changed = false;

    for i in 0..chars.len() {
        if chars[i] == '-'
            && i > 0
            && i < chars.len() - 1
            && chars[i - 1].is_ascii_digit()
            && chars[i + 1].is_ascii_digit()
        {
            let is_multi_digit_before = i >= 2 && chars[i - 2].is_ascii_digit();
            let is_multi_digit_after = i + 2 < chars.len() && chars[i + 2].is_ascii_digit();
            let looks_like_date = is_multi_digit_before || is_multi_digit_after;

            if looks_like_date {
                result.push(chars[i]);
            } else {
                result.push('.');
                changed = true;
            }
        } else {
            result.push(chars[i]);
        }
    }

    if changed {
        Some(result)
    } else {
        None
    }
}

fn is_fuzzy_eligible(model_id: &str) -> bool {
    if model_id.len() < MIN_FUZZY_MATCH_LEN {
        return false;
    }
    !FUZZY_BLOCKLIST.iter().any(|blocked| model_id == *blocked)
}

fn strip_tier_suffix(model_id: &str) -> Option<&str> {
    for suffix in TIER_SUFFIXES {
        if model_id.ends_with(suffix) {
            return Some(&model_id[..model_id.len() - suffix.len()]);
        }
    }
    None
}

/// Strips fallback suffixes from model IDs for pricing lookup.
/// Returns the base model ID if a fallback suffix is found, None otherwise.
/// Longer suffixes are checked first to handle cases like "-codex-max" before "-codex".
fn strip_fallback_suffix(model_id: &str) -> Option<&str> {
    // FALLBACK_SUFFIXES should be ordered with longer suffixes first,
    // but we sort by length descending to be safe
    let mut suffixes: Vec<&str> = FALLBACK_SUFFIXES.to_vec();
    suffixes.sort_by(|a, b| b.len().cmp(&a.len()));

    for suffix in suffixes {
        if model_id.ends_with(suffix) {
            return Some(&model_id[..model_id.len() - suffix.len()]);
        }
    }
    None
}

fn strip_routing_prefix(model_id: &str) -> &str {
    let lower = model_id.to_lowercase();
    for prefix in STRIPPED_PREFIXES {
        if lower.starts_with(prefix) {
            return &model_id[prefix.len()..];
        }
    }
    model_id
}

fn is_original_provider(key: &str) -> bool {
    let lower = key.to_lowercase();
    ORIGINAL_PROVIDER_PREFIXES
        .iter()
        .any(|prefix| lower.starts_with(prefix))
}

fn is_reseller_provider(key: &str) -> bool {
    let lower = key.to_lowercase();
    RESELLER_PROVIDER_PREFIXES
        .iter()
        .any(|prefix| lower.starts_with(prefix))
}

fn select_best_match<'a>(
    matches: &[&'a String],
    dataset: &HashMap<String, ModelPricing>,
    source: &str,
) -> Option<LookupResult> {
    if matches.is_empty() {
        return None;
    }

    if let Some(key) = matches.iter().find(|k| is_original_provider(k)) {
        return Some(LookupResult {
            pricing: dataset.get(*key).unwrap().clone(),
            source: source.into(),
            matched_key: (*key).clone(),
        });
    }

    if let Some(key) = matches.iter().find(|k| !is_reseller_provider(k)) {
        return Some(LookupResult {
            pricing: dataset.get(*key).unwrap().clone(),
            source: source.into(),
            matched_key: (*key).clone(),
        });
    }

    let key = matches[0];
    Some(LookupResult {
        pricing: dataset.get(key).unwrap().clone(),
        source: source.into(),
        matched_key: key.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Mock LiteLLM data matching real API responses for OpenCode Zen models
    fn mock_litellm() -> HashMap<String, ModelPricing> {
        let mut m = HashMap::new();

        // === GPT-4 models (baseline) ===
        m.insert(
            "gpt-4o".into(),
            ModelPricing {
                input_cost_per_token: Some(0.0000025),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(0.00000125),
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "gpt-4-turbo".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00001),
                output_cost_per_token: Some(0.00003),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );

        // === OpenCode Zen: GPT-5 family ===
        m.insert(
            "gpt-5.2".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000175),
                output_cost_per_token: Some(0.000014),
                cache_read_input_token_cost: Some(1.75e-7),
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "gpt-5.1".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(1.25e-7),
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "gpt-5.1-codex".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(1.25e-7),
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "gpt-5.1-codex-max".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(1.25e-7),
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "gpt-5".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(1.25e-7),
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "gpt-5-codex".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(1.25e-7),
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "gpt-5-nano".into(),
            ModelPricing {
                input_cost_per_token: Some(5e-8),
                output_cost_per_token: Some(4e-7),
                cache_read_input_token_cost: Some(5e-9),
                cache_creation_input_token_cost: None,
            },
        );

        // === OpenCode Zen: Claude family (LiteLLM entries) ===
        m.insert(
            "claude-3-5-sonnet-20241022".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000003),
                output_cost_per_token: Some(0.000015),
                cache_read_input_token_cost: Some(0.0000003),
                cache_creation_input_token_cost: Some(0.00000375),
            },
        );
        m.insert(
            "claude-sonnet-4-5".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000003),
                output_cost_per_token: Some(0.000015),
                cache_read_input_token_cost: Some(3e-7),
                cache_creation_input_token_cost: Some(0.00000375),
            },
        );
        m.insert(
            "claude-haiku-4-5".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000001),
                output_cost_per_token: Some(0.000005),
                cache_read_input_token_cost: Some(1e-7),
                cache_creation_input_token_cost: Some(0.00000125),
            },
        );
        m.insert(
            "bedrock/us.anthropic.claude-3-5-haiku-20241022-v1:0".into(),
            ModelPricing {
                input_cost_per_token: Some(8e-7),
                output_cost_per_token: Some(0.000004),
                cache_read_input_token_cost: Some(8e-8),
                cache_creation_input_token_cost: Some(0.000001),
            },
        );
        m.insert(
            "claude-opus-4-5".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000005),
                output_cost_per_token: Some(0.000025),
                cache_read_input_token_cost: Some(5e-7),
                cache_creation_input_token_cost: Some(0.00000625),
            },
        );
        m.insert(
            "claude-opus-4-1".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000015),
                output_cost_per_token: Some(0.000075),
                cache_read_input_token_cost: Some(0.0000015),
                cache_creation_input_token_cost: Some(0.00001875),
            },
        );

        // === OpenCode Zen: Gemini family (LiteLLM entries) ===
        m.insert(
            "openrouter/google/gemini-3-pro-preview".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000002),
                output_cost_per_token: Some(0.000012),
                cache_read_input_token_cost: Some(2e-7),
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "vertex_ai/gemini-3-flash-preview".into(),
            ModelPricing {
                input_cost_per_token: Some(5e-7),
                output_cost_per_token: Some(0.000003),
                cache_read_input_token_cost: Some(5e-8),
                cache_creation_input_token_cost: None,
            },
        );

        // === OpenCode Zen: Grok (LiteLLM entry) ===
        m.insert(
            "xai/grok-code-fast-1-0825".into(),
            ModelPricing {
                input_cost_per_token: Some(2e-7),
                output_cost_per_token: Some(0.0000015),
                cache_read_input_token_cost: Some(2e-8),
                cache_creation_input_token_cost: None,
            },
        );

        m.insert(
            "azure_ai/grok-code-fast-1".into(),
            ModelPricing {
                input_cost_per_token: Some(0.0000035),
                output_cost_per_token: Some(0.0000175),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "bedrock/anthropic.claude-sonnet-4".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000003),
                output_cost_per_token: Some(0.000015),
                cache_read_input_token_cost: Some(3e-7),
                cache_creation_input_token_cost: Some(0.00000375),
            },
        );
        m.insert(
            "vertex_ai/gemini-2.5-pro".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.000005),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "google/gemini-2.5-pro".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.000005),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );

        m
    }

    /// Mock OpenRouter data matching real API responses for OpenCode Zen models
    fn mock_openrouter() -> HashMap<String, ModelPricing> {
        let mut m = HashMap::new();

        // === Baseline models ===
        m.insert(
            "openai/gpt-4o".into(),
            ModelPricing {
                input_cost_per_token: Some(0.0000025),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(0.00000125),
                cache_creation_input_token_cost: None,
            },
        );

        // === OpenCode Zen: Claude (OpenRouter entries) ===
        m.insert(
            "anthropic/claude-sonnet-4".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000003),
                output_cost_per_token: Some(0.000015),
                cache_read_input_token_cost: Some(3e-7),
                cache_creation_input_token_cost: Some(0.00000375),
            },
        );
        m.insert(
            "anthropic/claude-opus-4-5".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000005),
                output_cost_per_token: Some(0.000025),
                cache_read_input_token_cost: Some(0.0000005),
                cache_creation_input_token_cost: Some(0.00000625),
            },
        );
        m.insert(
            "anthropic/claude-3.5-haiku".into(),
            ModelPricing {
                input_cost_per_token: Some(8e-7),
                output_cost_per_token: Some(0.000004),
                cache_read_input_token_cost: Some(8e-8),
                cache_creation_input_token_cost: Some(0.000001),
            },
        );

        // === OpenCode Zen: GLM family ===
        m.insert(
            "z-ai/glm-4.7".into(),
            ModelPricing {
                input_cost_per_token: Some(4e-7),
                output_cost_per_token: Some(0.0000015),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "z-ai/glm-4.6".into(),
            ModelPricing {
                input_cost_per_token: Some(3.9e-7),
                output_cost_per_token: Some(0.0000019),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );

        // === OpenCode Zen: Kimi family ===
        m.insert(
            "moonshotai/kimi-k2".into(),
            ModelPricing {
                input_cost_per_token: Some(4.56e-7),
                output_cost_per_token: Some(0.00000184),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );
        m.insert(
            "moonshotai/kimi-k2-thinking".into(),
            ModelPricing {
                input_cost_per_token: Some(4e-7),
                output_cost_per_token: Some(0.00000175),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );

        // === OpenCode Zen: Qwen family ===
        m.insert(
            "qwen/qwen3-coder".into(),
            ModelPricing {
                input_cost_per_token: Some(2.2e-7),
                output_cost_per_token: Some(9.5e-7),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );

        m
    }

    fn create_lookup() -> PricingLookup {
        PricingLookup::new(mock_litellm(), mock_openrouter())
    }

    // =========================================================================
    // OPENCODE ZEN MODELS - GPT-5 FAMILY
    // All models from https://opencode.ai/docs/zen/
    // =========================================================================

    #[test]
    fn test_opencode_zen_gpt_5_2() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5.2").unwrap();
        assert_eq!(result.matched_key, "gpt-5.2");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_gpt_5_1() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5.1").unwrap();
        assert_eq!(result.matched_key, "gpt-5.1");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_gpt_5_1_codex() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5.1-codex").unwrap();
        assert_eq!(result.matched_key, "gpt-5.1-codex");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_gpt_5_1_codex_max() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5.1-codex-max").unwrap();
        assert_eq!(result.matched_key, "gpt-5.1-codex-max");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_gpt_5() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5").unwrap();
        assert_eq!(result.matched_key, "gpt-5");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_gpt_5_codex() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5-codex").unwrap();
        assert_eq!(result.matched_key, "gpt-5-codex");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_gpt_5_nano() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5-nano").unwrap();
        assert_eq!(result.matched_key, "gpt-5-nano");
        assert_eq!(result.source, "LiteLLM");
    }

    // =========================================================================
    // OPENCODE ZEN MODELS - CLAUDE FAMILY
    // =========================================================================

    #[test]
    fn test_opencode_zen_claude_sonnet_4_5() {
        let lookup = create_lookup();
        let result = lookup.lookup("claude-sonnet-4-5").unwrap();
        assert_eq!(result.matched_key, "claude-sonnet-4-5");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_claude_sonnet_4() {
        let lookup = create_lookup();
        let result = lookup.lookup("claude-sonnet-4").unwrap();
        assert_eq!(result.matched_key, "anthropic/claude-sonnet-4");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_opencode_zen_claude_haiku_4_5() {
        let lookup = create_lookup();
        let result = lookup.lookup("claude-haiku-4-5").unwrap();
        assert_eq!(result.matched_key, "claude-haiku-4-5");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_claude_3_5_haiku() {
        let lookup = create_lookup();
        let result = lookup.lookup("claude-3-5-haiku").unwrap();
        assert_eq!(result.matched_key, "anthropic/claude-3.5-haiku");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_opencode_zen_claude_3_5_haiku_with_dot() {
        let lookup = create_lookup();
        let result = lookup.lookup("claude-3.5-haiku").unwrap();
        assert_eq!(result.matched_key, "anthropic/claude-3.5-haiku");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_opencode_zen_claude_opus_4_5() {
        let lookup = create_lookup();
        let result = lookup.lookup("claude-opus-4-5").unwrap();
        assert_eq!(result.matched_key, "claude-opus-4-5");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_claude_opus_4_1() {
        let lookup = create_lookup();
        let result = lookup.lookup("claude-opus-4-1").unwrap();
        assert_eq!(result.matched_key, "claude-opus-4-1");
        assert_eq!(result.source, "LiteLLM");
    }

    // =========================================================================
    // OPENCODE ZEN MODELS - GLM FAMILY
    // =========================================================================

    #[test]
    fn test_opencode_zen_glm_4_7_free() {
        let lookup = create_lookup();
        let result = lookup.lookup("glm-4.7-free").unwrap();
        assert_eq!(result.matched_key, "z-ai/glm-4.7");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_opencode_zen_glm_4_6() {
        let lookup = create_lookup();
        let result = lookup.lookup("glm-4.6").unwrap();
        assert_eq!(result.matched_key, "z-ai/glm-4.6");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_opencode_zen_glm_4_7_with_hyphen() {
        let lookup = create_lookup();
        let result = lookup.lookup("glm-4-7").unwrap();
        assert_eq!(result.matched_key, "z-ai/glm-4.7");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_opencode_zen_glm_4_6_with_hyphen() {
        let lookup = create_lookup();
        let result = lookup.lookup("glm-4-6").unwrap();
        assert_eq!(result.matched_key, "z-ai/glm-4.6");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_opencode_zen_big_pickle() {
        let lookup = create_lookup();
        let result = lookup.lookup("big-pickle").unwrap();
        assert_eq!(result.matched_key, "z-ai/glm-4.7");
        assert_eq!(result.source, "OpenRouter");
    }

    // =========================================================================
    // OPENCODE ZEN MODELS - GEMINI FAMILY
    // =========================================================================

    #[test]
    fn test_opencode_zen_gemini_3_pro() {
        let lookup = create_lookup();
        let result = lookup.lookup("gemini-3-pro").unwrap();
        assert_eq!(result.matched_key, "openrouter/google/gemini-3-pro-preview");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_opencode_zen_gemini_3_flash() {
        let lookup = create_lookup();
        let result = lookup.lookup("gemini-3-flash").unwrap();
        assert_eq!(result.matched_key, "vertex_ai/gemini-3-flash-preview");
        assert_eq!(result.source, "LiteLLM");
    }

    // =========================================================================
    // OPENCODE ZEN MODELS - KIMI FAMILY
    // =========================================================================

    #[test]
    fn test_opencode_zen_kimi_k2() {
        let lookup = create_lookup();
        let result = lookup.lookup("kimi-k2").unwrap();
        assert_eq!(result.matched_key, "moonshotai/kimi-k2");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_opencode_zen_kimi_k2_thinking() {
        let lookup = create_lookup();
        let result = lookup.lookup("kimi-k2-thinking").unwrap();
        assert_eq!(result.matched_key, "moonshotai/kimi-k2-thinking");
        assert_eq!(result.source, "OpenRouter");
    }

    // =========================================================================
    // OPENCODE ZEN MODELS - QWEN FAMILY
    // =========================================================================

    #[test]
    fn test_opencode_zen_qwen3_coder() {
        let lookup = create_lookup();
        let result = lookup.lookup("qwen3-coder").unwrap();
        assert_eq!(result.matched_key, "qwen/qwen3-coder");
        assert_eq!(result.source, "OpenRouter");
    }

    // =========================================================================
    // OPENCODE ZEN MODELS - GROK FAMILY
    // =========================================================================

    #[test]
    fn test_opencode_zen_grok_code() {
        let lookup = create_lookup();
        let result = lookup.lookup("grok-code").unwrap();
        assert_eq!(result.matched_key, "xai/grok-code-fast-1-0825");
        assert_eq!(result.source, "LiteLLM");
    }

    // =========================================================================
    // BASELINE / LEGACY TESTS
    // =========================================================================

    #[test]
    fn test_exact_match_litellm() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-4o").unwrap();
        assert_eq!(result.matched_key, "gpt-4o");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_exact_match_openrouter() {
        let lookup = create_lookup();
        let result = lookup.lookup("z-ai/glm-4.7").unwrap();
        assert_eq!(result.matched_key, "z-ai/glm-4.7");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_openrouter_model_part_match() {
        let lookup = create_lookup();
        let result = lookup.lookup("glm-4.7").unwrap();
        assert_eq!(result.matched_key, "z-ai/glm-4.7");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_tier_suffix_low() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5.1-codex-low").unwrap();
        assert_eq!(result.matched_key, "gpt-5.1-codex");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_tier_suffix_high() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-4o-high").unwrap();
        assert_eq!(result.matched_key, "gpt-4o");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_tier_suffix_free() {
        let lookup = create_lookup();
        let result = lookup.lookup("glm-4.7-free").unwrap();
        assert_eq!(result.matched_key, "z-ai/glm-4.7");
        assert_eq!(result.source, "OpenRouter");
    }

    #[test]
    fn test_tier_suffix_xhigh() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5.2-xhigh").unwrap();
        assert_eq!(result.matched_key, "gpt-5.2");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_tier_suffix_xhigh_codex_max() {
        let lookup = create_lookup();
        let result = lookup.lookup("gpt-5.1-codex-max-xhigh").unwrap();
        assert_eq!(result.matched_key, "gpt-5.1-codex-max");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_normalize_opus_4_5() {
        let lookup = create_lookup();
        let result = lookup.lookup("opus-4-5").unwrap();
        assert_eq!(result.matched_key, "claude-opus-4-5");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_blocklist_auto() {
        let lookup = create_lookup();
        assert!(lookup.lookup("auto").is_none());
    }

    #[test]
    fn test_blocklist_mini() {
        let lookup = create_lookup();
        assert!(lookup.lookup("mini").is_none());
    }

    #[test]
    fn test_force_source_litellm() {
        let lookup = create_lookup();
        let result = lookup
            .lookup_with_source("gpt-4o", Some("litellm"))
            .unwrap();
        assert_eq!(result.source, "LiteLLM");
        assert_eq!(result.matched_key, "gpt-4o");
    }

    #[test]
    fn test_force_source_openrouter() {
        let lookup = create_lookup();
        let result = lookup
            .lookup_with_source("gpt-4o", Some("openrouter"))
            .unwrap();
        assert_eq!(result.source, "OpenRouter");
        assert_eq!(result.matched_key, "openai/gpt-4o");
    }

    #[test]
    fn test_case_insensitive() {
        let lookup = create_lookup();
        let result = lookup.lookup("GPT-4O").unwrap();
        assert_eq!(result.matched_key, "gpt-4o");
    }

    #[test]
    fn test_fuzzy_match_gemini() {
        let lookup = create_lookup();
        let result = lookup.lookup("gemini-3-pro").unwrap();
        assert_eq!(result.matched_key, "openrouter/google/gemini-3-pro-preview");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_tier_suffix_with_fuzzy() {
        let lookup = create_lookup();
        let result = lookup.lookup("gemini-3-pro-high").unwrap();
        assert_eq!(result.matched_key, "openrouter/google/gemini-3-pro-preview");
    }

    #[test]
    fn test_nonexistent_model() {
        let lookup = create_lookup();
        assert!(lookup.lookup("nonexistent-model-xyz").is_none());
    }

    #[test]
    fn test_strip_tier_suffix_fn() {
        assert_eq!(strip_tier_suffix("gpt-4o-low"), Some("gpt-4o"));
        assert_eq!(strip_tier_suffix("model-high"), Some("model"));
        assert_eq!(strip_tier_suffix("model-medium"), Some("model"));
        assert_eq!(strip_tier_suffix("model-free"), Some("model"));
        assert_eq!(strip_tier_suffix("model:low"), Some("model"));
        assert_eq!(strip_tier_suffix("model:high"), Some("model"));
        assert_eq!(strip_tier_suffix("gpt-5.2-xhigh"), Some("gpt-5.2"));
        assert_eq!(
            strip_tier_suffix("gpt-5.1-codex-max-xhigh"),
            Some("gpt-5.1-codex-max")
        );
        assert_eq!(strip_tier_suffix("gpt-4o"), None);
        assert_eq!(strip_tier_suffix("claude-3-5-sonnet"), None);
    }

    #[test]
    fn test_strip_fallback_suffix_fn() {
        // Basic -codex suffix stripping
        assert_eq!(strip_fallback_suffix("gpt-5-codex"), Some("gpt-5"));
        assert_eq!(strip_fallback_suffix("gpt-5.1-codex"), Some("gpt-5.1"));
        assert_eq!(
            strip_fallback_suffix("some-model-codex"),
            Some("some-model")
        );

        // -codex-max should be stripped before -codex (longer suffix first)
        assert_eq!(strip_fallback_suffix("gpt-5.1-codex-max"), Some("gpt-5.1"));

        // No fallback suffix present
        assert_eq!(strip_fallback_suffix("gpt-5"), None);
        assert_eq!(strip_fallback_suffix("claude-3-5-sonnet"), None);
        assert_eq!(strip_fallback_suffix("gpt-4o"), None);

        // Suffix in middle doesn't match (must be at end)
        assert_eq!(strip_fallback_suffix("codex-model"), None);
    }

    #[test]
    fn test_fallback_suffix_lookup() {
        // Create a lookup with only the base model (no -codex variant)
        let mut litellm = HashMap::new();
        litellm.insert(
            "gpt-5".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(1.25e-7),
                cache_creation_input_token_cost: None,
            },
        );
        // Note: gpt-5-codex is NOT in the pricing data

        let lookup = PricingLookup::new(litellm, HashMap::new());

        // Looking up gpt-5-codex should fall back to gpt-5
        let result = lookup.lookup("gpt-5-codex").unwrap();
        assert_eq!(result.matched_key, "gpt-5");
        assert_eq!(result.source, "LiteLLM");

        // Looking up gpt-5-codex-max should also fall back to gpt-5
        let result = lookup.lookup("gpt-5-codex-max").unwrap();
        assert_eq!(result.matched_key, "gpt-5");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_fallback_suffix_with_tier_suffix() {
        // Test that tier suffix + fallback suffix both work together
        let mut litellm = HashMap::new();
        litellm.insert(
            "gpt-5".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: Some(1.25e-7),
                cache_creation_input_token_cost: None,
            },
        );

        let lookup = PricingLookup::new(litellm, HashMap::new());

        // gpt-5-codex-high should strip -high first, then fall back from gpt-5-codex to gpt-5
        let result = lookup.lookup("gpt-5-codex-high").unwrap();
        assert_eq!(result.matched_key, "gpt-5");
        assert_eq!(result.source, "LiteLLM");

        // gpt-5-codex-max-xhigh should strip -xhigh first, then fall back from gpt-5-codex-max to gpt-5
        let result = lookup.lookup("gpt-5-codex-max-xhigh").unwrap();
        assert_eq!(result.matched_key, "gpt-5");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_fallback_suffix_prefers_exact_match() {
        // If the exact model exists, it should be used (no fallback)
        let mut litellm = HashMap::new();
        litellm.insert(
            "gpt-5".into(),
            ModelPricing {
                input_cost_per_token: Some(0.00000125),
                output_cost_per_token: Some(0.00001),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );
        litellm.insert(
            "gpt-5-codex".into(),
            ModelPricing {
                input_cost_per_token: Some(0.000002), // Different price to verify which one is used
                output_cost_per_token: Some(0.000015),
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );

        let lookup = PricingLookup::new(litellm, HashMap::new());

        // Should use the exact match, not fall back
        let result = lookup.lookup("gpt-5-codex").unwrap();
        assert_eq!(result.matched_key, "gpt-5-codex");
        assert_eq!(result.pricing.input_cost_per_token, Some(0.000002));
    }

    #[test]
    fn test_normalize_version_separator() {
        assert_eq!(
            normalize_version_separator("glm-4-7"),
            Some("glm-4.7".into())
        );
        assert_eq!(
            normalize_version_separator("glm-4-6"),
            Some("glm-4.6".into())
        );
        assert_eq!(
            normalize_version_separator("claude-3-5-haiku"),
            Some("claude-3.5-haiku".into())
        );
        assert_eq!(
            normalize_version_separator("gpt-5-1-codex"),
            Some("gpt-5.1-codex".into())
        );
        assert_eq!(normalize_version_separator("gpt-4o"), None);
        assert_eq!(normalize_version_separator("claude-sonnet"), None);
        assert_eq!(normalize_version_separator("big-pickle"), None);
    }

    #[test]
    fn test_normalize_version_separator_preserves_dates() {
        assert_eq!(normalize_version_separator("2024-11-20"), None);
        assert_eq!(normalize_version_separator("model-2024-11-20"), None);
        assert_eq!(
            normalize_version_separator("claude-3-5-sonnet-20241022"),
            Some("claude-3.5-sonnet-20241022".into())
        );
        assert_eq!(normalize_version_separator("sonnet-20241022"), None);
        assert_eq!(normalize_version_separator("model-20241022-v1"), None);
    }

    #[test]
    fn test_is_fuzzy_eligible() {
        assert!(!is_fuzzy_eligible("auto"));
        assert!(!is_fuzzy_eligible("mini"));
        assert!(!is_fuzzy_eligible("chat"));
        assert!(!is_fuzzy_eligible("base"));
        assert!(!is_fuzzy_eligible("abc"));
        assert!(is_fuzzy_eligible("gpt-4o"));
        assert!(is_fuzzy_eligible("claude"));
    }

    // =========================================================================
    // PROVIDER PREFERENCE TESTS
    // =========================================================================

    #[test]
    fn test_provider_preference_grok_prefers_xai_over_azure() {
        let lookup = create_lookup();
        let result = lookup.lookup("grok-code").unwrap();
        assert_eq!(result.matched_key, "xai/grok-code-fast-1-0825");
        assert_eq!(result.source, "LiteLLM");
        assert!(!result.matched_key.starts_with("azure"));
    }

    /// Test that documents the exact before/after behavior for grok-code provider preference.
    /// This test explicitly verifies that the original provider (xai/) is preferred over resellers (azure_ai/).
    #[test]
    fn test_grok_code_prefers_xai_over_azure() {
        // =========================================================================
        // BEFORE FIX: grok-code → azure_ai/grok-code-fast-1 ($3.50/$17.50) ❌ reseller
        // AFTER FIX:  grok-code → xai/grok-code-fast-1-0825 ($0.20/$1.50) ✅ original provider
        //
        // The azure_ai/ prefix indicates a reseller (Azure AI marketplace), which typically
        // has higher prices. The xai/ prefix indicates the original provider (X.AI/Grok),
        // which offers lower direct pricing. Our lookup should prefer the original provider.
        // =========================================================================

        let mut litellm = HashMap::new();

        // Reseller entry: azure_ai/ prefix with higher prices ($3.50/$17.50 per 1M tokens)
        litellm.insert(
            "azure_ai/grok-code-fast-1".to_string(),
            ModelPricing {
                input_cost_per_token: Some(0.0000035),  // $3.50/1M tokens
                output_cost_per_token: Some(0.0000175), // $17.50/1M tokens
                cache_read_input_token_cost: None,
                cache_creation_input_token_cost: None,
            },
        );

        // Original provider entry: xai/ prefix with lower prices ($0.20/$1.50 per 1M tokens)
        litellm.insert(
            "xai/grok-code-fast-1-0825".to_string(),
            ModelPricing {
                input_cost_per_token: Some(0.0000002),  // $0.20/1M tokens
                output_cost_per_token: Some(0.0000015), // $1.50/1M tokens
                cache_read_input_token_cost: Some(0.00000002),
                cache_creation_input_token_cost: None,
            },
        );

        let lookup = PricingLookup::new(litellm, HashMap::new());
        let result = lookup.lookup("grok-code").unwrap();

        // Must prefer xai (original provider) over azure_ai (reseller)
        assert!(
            result.matched_key.starts_with("xai/"),
            "Expected xai/ prefix (original provider) but got: {}. \
             The lookup should prefer original providers over resellers.",
            result.matched_key
        );
        assert_eq!(
            result.matched_key, "xai/grok-code-fast-1-0825",
            "Should match the xai/grok-code-fast-1-0825 entry, not azure_ai/grok-code-fast-1"
        );

        // Verify we got the lower price (original provider)
        let pricing = &result.pricing;
        assert!(
            pricing.input_cost_per_token.unwrap() < 0.000001,
            "Input cost should be ~$0.20/1M (0.0000002), not ~$3.50/1M (reseller price)"
        );
        assert!(
            pricing.output_cost_per_token.unwrap() < 0.000005,
            "Output cost should be ~$1.50/1M (0.0000015), not ~$17.50/1M (reseller price)"
        );
    }

    #[test]
    fn test_provider_preference_gemini_prefers_google_over_vertex() {
        let lookup = create_lookup();
        let result = lookup.lookup("gemini-2.5-pro").unwrap();
        assert_eq!(result.matched_key, "google/gemini-2.5-pro");
        assert_eq!(result.source, "LiteLLM");
        assert!(!result.matched_key.starts_with("vertex_ai"));
    }

    #[test]
    fn test_is_original_provider() {
        assert!(is_original_provider("xai/grok-code"));
        assert!(is_original_provider("anthropic/claude-3"));
        assert!(is_original_provider("openai/gpt-4"));
        assert!(is_original_provider("google/gemini"));
        assert!(is_original_provider("x-ai/grok"));
        assert!(!is_original_provider("azure_ai/grok"));
        assert!(!is_original_provider("bedrock/anthropic"));
        assert!(!is_original_provider("vertex_ai/gemini"));
        assert!(!is_original_provider("unknown-provider/model"));
    }

    #[test]
    fn test_is_reseller_provider() {
        assert!(is_reseller_provider("azure_ai/grok-code"));
        assert!(is_reseller_provider("azure/openai/gpt-4"));
        assert!(is_reseller_provider("bedrock/anthropic.claude"));
        assert!(is_reseller_provider("vertex_ai/gemini"));
        assert!(is_reseller_provider("together_ai/llama"));
        assert!(is_reseller_provider("groq/llama"));
        assert!(!is_reseller_provider("xai/grok"));
        assert!(!is_reseller_provider("anthropic/claude"));
        assert!(!is_reseller_provider("openai/gpt-4"));
    }

    // =========================================================================
    // COST CALCULATION TESTS
    // =========================================================================

    #[test]
    fn test_calculate_cost_gpt_5_2() {
        let lookup = create_lookup();
        // 1M input, 500K output tokens
        let cost = lookup.calculate_cost("gpt-5.2", 1_000_000, 500_000, 0, 0, 0);
        // input: 1M * 0.00000175 = 1.75, output: 500K * 0.000014 = 7.0
        assert!((cost - 8.75).abs() < 0.001);
    }

    #[test]
    fn test_calculate_cost_claude_sonnet_4_5() {
        let lookup = create_lookup();
        // 100K input, 50K output, 200K cache read
        let cost = lookup.calculate_cost("claude-sonnet-4-5", 100_000, 50_000, 200_000, 0, 0);
        // input: 100K * 0.000003 = 0.30, output: 50K * 0.000015 = 0.75, cache: 200K * 3e-7 = 0.06
        assert!((cost - 1.11).abs() < 0.001);
    }

    #[test]
    fn test_calculate_cost_unknown_model() {
        let lookup = create_lookup();
        let cost = lookup.calculate_cost("nonexistent-model", 1_000_000, 500_000, 0, 0, 0);
        assert_eq!(cost, 0.0);
    }

    // =========================================================================
    // ROUTING PREFIX TESTS (e.g., antigravity-auth plugin)
    // =========================================================================

    #[test]
    fn test_strip_routing_prefix_fn() {
        assert_eq!(
            strip_routing_prefix("antigravity-gemini-3-flash"),
            "gemini-3-flash"
        );
        assert_eq!(
            strip_routing_prefix("antigravity-claude-sonnet-4-5"),
            "claude-sonnet-4-5"
        );
        assert_eq!(strip_routing_prefix("Antigravity-gpt-4o"), "gpt-4o");
        assert_eq!(strip_routing_prefix("ANTIGRAVITY-gpt-4o"), "gpt-4o");
        assert_eq!(strip_routing_prefix("gemini-3-flash"), "gemini-3-flash");
        assert_eq!(strip_routing_prefix("gpt-4o"), "gpt-4o");
    }

    #[test]
    fn test_antigravity_prefix_gemini_3_flash() {
        let lookup = create_lookup();
        let result = lookup.lookup("antigravity-gemini-3-flash").unwrap();
        assert_eq!(result.matched_key, "vertex_ai/gemini-3-flash-preview");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_antigravity_prefix_gemini_3_pro() {
        let lookup = create_lookup();
        let result = lookup.lookup("antigravity-gemini-3-pro").unwrap();
        assert_eq!(result.matched_key, "openrouter/google/gemini-3-pro-preview");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_antigravity_prefix_with_tier_suffix() {
        let lookup = create_lookup();
        let result = lookup.lookup("antigravity-gemini-3-pro-high").unwrap();
        assert_eq!(result.matched_key, "openrouter/google/gemini-3-pro-preview");
    }

    #[test]
    fn test_antigravity_prefix_claude() {
        let lookup = create_lookup();
        let result = lookup.lookup("antigravity-claude-sonnet-4-5").unwrap();
        assert_eq!(result.matched_key, "claude-sonnet-4-5");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_antigravity_prefix_gpt() {
        let lookup = create_lookup();
        let result = lookup.lookup("antigravity-gpt-4o").unwrap();
        assert_eq!(result.matched_key, "gpt-4o");
        assert_eq!(result.source, "LiteLLM");
    }

    #[test]
    fn test_antigravity_prefix_case_insensitive() {
        let lookup = create_lookup();
        let result = lookup.lookup("Antigravity-gpt-4o").unwrap();
        assert_eq!(result.matched_key, "gpt-4o");
    }

    #[test]
    fn test_antigravity_cost_calculation() {
        let lookup = create_lookup();
        let cost_with_prefix =
            lookup.calculate_cost("antigravity-gpt-5.2", 1_000_000, 500_000, 0, 0, 0);
        let cost_without_prefix = lookup.calculate_cost("gpt-5.2", 1_000_000, 500_000, 0, 0, 0);
        assert!((cost_with_prefix - cost_without_prefix).abs() < 0.001);
        assert!(cost_with_prefix > 0.0);
    }
}
