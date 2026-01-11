.PHONY: sync

sync:
	cp ~/.config/opencode/agent/*.md .
	git add -A && git commit -m "chore: sync agent definitions from local config - $$(date +'%Y-%m-%d %H:%M:%S')"
