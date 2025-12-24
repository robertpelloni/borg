import re
import os

readme_path = 'temp_dan_repo/README.md'
output_dir = 'prompts/jailbreak'

os.makedirs(output_dir, exist_ok=True)

with open(readme_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find <details><summary>Title</summary>...content...</details>
# Note: The README structure is nested for the first DAN.
# We will use a regex to capture summary title and content.
# Since it's nested and messy, we might need a simpler approach or robust parsing.
# The README has:
# <details>
#   <summary>The DAN 13.0 Prompt (Available on GPT-4)</summary>
#   ... content ...
# </details>

# Let's just find all <summary>(.*?)</summary> and then grab the text until </details>
# But they are nested.
# Let's iterate through lines.

prompts = []
current_title = None
current_content = []
in_details = False

lines = content.split('\n')
for line in lines:
    if '<summary>' in line:
        # Save previous if exists
        if current_title and current_content:
            prompts.append((current_title, '\n'.join(current_content).strip()))
            current_content = []

        match = re.search(r'<summary>(.*?)</summary>', line)
        if match:
            current_title = match.group(1).strip()
            # Remove html tags from title for filename
            current_title = re.sub(r'<[^>]+>', '', current_title)
            # Remove special chars
            current_title = re.sub(r'[^\w\s\.-]', '', current_title).strip()

    elif '</details>' in line:
        if current_title and current_content:
            prompts.append((current_title, '\n'.join(current_content).strip()))
            current_title = None
            current_content = []

    elif current_title:
        # Clean up lines?
        if line.strip() == '<details>' or line.strip() == '':
            continue
        # Remove blockquotes html
        clean_line = re.sub(r'<blockquote>.*?</blockquote>', '', line)
        if clean_line.strip():
            current_content.append(clean_line)

# Save the last one if any
if current_title and current_content:
    prompts.append((current_title, '\n'.join(current_content).strip()))

print(f"Found {len(prompts)} prompts.")

for title, text in prompts:
    # Sanitize filename
    filename = title.replace(' ', '_').replace('/', '-') + '.md'
    filepath = os.path.join(output_dir, filename)

    # Clean text (remove html links etc if needed, but keeping them is fine usually)
    # Ensure text is not empty
    if not text:
        continue

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Saved {filepath}")
