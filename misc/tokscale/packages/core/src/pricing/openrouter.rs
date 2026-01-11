use super::cache;
use super::litellm::ModelPricing;
use std::collections::HashMap;
use std::sync::Arc;
use serde::Deserialize;
use tokio::sync::Semaphore;

const CACHE_FILENAME: &str = "pricing-openrouter.json";
const MODELS_URL: &str = "https://openrouter.ai/api/v1/models";
const MAX_RETRIES: u32 = 3;
const INITIAL_BACKOFF_MS: u64 = 200;
const MAX_CONCURRENT_REQUESTS: usize = 10;

/// Structs for `/api/v1/models` endpoint (list all models).

#[derive(Deserialize)]
struct ModelListItem {
    id: String,
}

#[derive(Deserialize)]
struct ModelsListResponse {
    data: Vec<ModelListItem>,
}

/// Structs for `/api/v1/models/{id}/endpoints` endpoint (author pricing).

#[derive(Deserialize)]
struct EndpointPricing {
    prompt: String,
    completion: String,
    #[serde(default)]
    input_cache_read: Option<String>,
    #[serde(default)]
    input_cache_write: Option<String>,
}

#[derive(Deserialize)]
struct Endpoint {
    provider_name: String,
    pricing: EndpointPricing,
}

#[derive(Deserialize)]
struct EndpointData {
    #[allow(dead_code)]
    id: String,
    endpoints: Vec<Endpoint>,
}

#[derive(Deserialize)]
struct EndpointsResponse {
    data: EndpointData,
}

/// Model ID prefix to provider name mapping.
///
/// Translates model ID prefixes like `z-ai` to their corresponding
/// provider names in the endpoints API, such as `Z.AI`.
fn get_author_provider_name(model_id: &str) -> Option<&'static str> {
    let prefix = model_id.split('/').next()?;
    
    match prefix.to_lowercase().as_str() {
        "z-ai" => Some("Z.AI"),
        "x-ai" => Some("xAI"),
        "anthropic" => Some("Anthropic"),
        "openai" => Some("OpenAI"),
        "google" => Some("Google"),
        "meta-llama" => Some("Meta"),
        "mistralai" => Some("Mistral"),
        "deepseek" => Some("DeepSeek"),
        "qwen" => Some("Alibaba"),
        "cohere" => Some("Cohere"),
        "perplexity" => Some("Perplexity"),
        "moonshotai" => Some("Moonshot AI"),
        _ => None,
    }
}

pub fn load_cached() -> Option<HashMap<String, ModelPricing>> {
    cache::load_cache(CACHE_FILENAME)
}

fn parse_price(s: &str) -> Option<f64> {
    s.trim().parse::<f64>().ok().filter(|v| v.is_finite() && *v >= 0.0)
}

/// Fetch author pricing for a specific model using the /endpoints API
async fn fetch_author_pricing(
    client: Arc<reqwest::Client>, 
    model_id: String,
    semaphore: Arc<Semaphore>,
) -> Option<(String, ModelPricing)> {
    let _permit = semaphore.acquire().await.ok()?;
    
    let author_name = get_author_provider_name(&model_id)?;
    
    let url = format!("https://openrouter.ai/api/v1/models/{}/endpoints", model_id);
    
    let response = match client.get(&url)
        .header("Content-Type", "application/json")
        .send()
        .await {
            Ok(r) => r,
            Err(e) => {
                eprintln!("[tokscale] endpoints fetch failed for {}: {}", model_id, e);
                return None;
            }
        };
    
    if !response.status().is_success() {
        eprintln!("[tokscale] endpoints API returned {} for {}", response.status(), model_id);
        return None;
    }
    
    let data: EndpointsResponse = match response.json().await {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[tokscale] endpoints JSON parse failed for {}: {}", model_id, e);
            return None;
        }
    };
    
    // Find the endpoint from the author provider
    let author_endpoint = match data.data.endpoints.iter()
        .find(|e| e.provider_name == author_name) {
            Some(ep) => ep,
            None => {
                eprintln!("[tokscale] author provider '{}' not found for {}", author_name, model_id);
                return None;
            }
        };
    
    let input_cost = parse_price(&author_endpoint.pricing.prompt)?;
    let output_cost = parse_price(&author_endpoint.pricing.completion)?;
    
    let pricing = ModelPricing {
        input_cost_per_token: Some(input_cost),
        output_cost_per_token: Some(output_cost),
        cache_read_input_token_cost: author_endpoint.pricing.input_cache_read
            .as_ref()
            .and_then(|s| parse_price(s)),
        cache_creation_input_token_cost: author_endpoint.pricing.input_cache_write
            .as_ref()
            .and_then(|s| parse_price(s)),
    };
    
    Some((model_id, pricing))
}

/// Fetch all models and get author pricing for each
pub async fn fetch_all_models() -> HashMap<String, ModelPricing> {
    if let Some(cached) = load_cached() {
        return cached;
    }
    
    let client = Arc::new(reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default());
    
    let mut last_error: Option<String> = None;
    
    // First, get the list of all models
    let model_ids: Vec<String> = 'retry: {
        for attempt in 0..MAX_RETRIES {
            let response = match client.get(MODELS_URL)
                .header("Content-Type", "application/json")
                .send()
                .await {
                    Ok(r) => r,
                    Err(e) => {
                        last_error = Some(format!("network error: {}", e));
                        if attempt < MAX_RETRIES - 1 {
                            tokio::time::sleep(std::time::Duration::from_millis(
                                INITIAL_BACKOFF_MS * (1 << attempt)
                            )).await;
                        }
                        continue;
                    }
                };
            
            let status = response.status();
            if status.is_server_error() || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                last_error = Some(format!("HTTP {}", status));
                let _ = response.bytes().await;
                if attempt < MAX_RETRIES - 1 {
                    tokio::time::sleep(std::time::Duration::from_millis(
                        INITIAL_BACKOFF_MS * (1 << attempt)
                    )).await;
                }
                continue;
            }
            
            if !status.is_success() {
                eprintln!("[tokscale] OpenRouter models API returned {}", status);
                break 'retry Vec::new();
            }
            
            let data: ModelsListResponse = match response.json().await {
                Ok(d) => d,
                Err(e) => {
                    eprintln!("[tokscale] OpenRouter models JSON parse failed: {}", e);
                    break 'retry Vec::new();
                }
            };
            
            break 'retry data.data.into_iter().map(|m| m.id).collect();
        }
        
        if let Some(err) = &last_error {
            eprintln!("[tokscale] OpenRouter fetch failed after {} retries: {}", MAX_RETRIES, err);
        }
        Vec::new()
    };
    
    if model_ids.is_empty() {
        return HashMap::new();
    }
    
    // Filter to only models with known author providers
    let models_with_authors: Vec<String> = model_ids.into_iter()
        .filter(|id| get_author_provider_name(id).is_some())
        .collect();
    
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_REQUESTS));
    
    // Spawn tasks for parallel fetching
    let mut handles = Vec::with_capacity(models_with_authors.len());
    
    for model_id in models_with_authors {
        let client = Arc::clone(&client);
        let sem = Arc::clone(&semaphore);
        
        let handle = tokio::spawn(async move {
            fetch_author_pricing(client, model_id, sem).await
        });
        
        handles.push(handle);
    }
    
    // Collect results
    let mut result = HashMap::new();
    
    for handle in handles {
        if let Ok(Some((model_id, pricing))) = handle.await {
            result.insert(model_id, pricing);
        }
    }
    
    if !result.is_empty() {
        let _ = cache::save_cache(CACHE_FILENAME, &result);
    }
    
    result
}

pub async fn fetch_all_mapped() -> HashMap<String, ModelPricing> {
    fetch_all_models().await
}
