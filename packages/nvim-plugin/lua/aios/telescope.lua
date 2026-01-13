local M = {}

local pickers = require("telescope.pickers")
local finders = require("telescope.finders")
local conf = require("telescope.config").values
local actions = require("telescope.actions")
local action_state = require("telescope.actions.state")

local aios = require("aios")
local curl = require("plenary.curl")

function M.debate_templates(opts)
    opts = opts or {}
    
    curl.get(aios.config.hub_url .. "/api/debate-templates", {
        callback = function(response)
            vim.schedule(function()
                if response.status ~= 200 then
                    vim.notify("Failed to fetch templates", vim.log.levels.ERROR)
                    return
                end
                
                local data = vim.fn.json_decode(response.body)
                
                pickers.new(opts, {
                    prompt_title = "AIOS Debate Templates",
                    finder = finders.new_table({
                        results = data.templates,
                        entry_maker = function(entry)
                            return {
                                value = entry,
                                display = entry.name .. " - " .. (entry.description or "No description"),
                                ordinal = entry.name .. " " .. entry.id,
                            }
                        end,
                    }),
                    sorter = conf.generic_sorter(opts),
                    attach_mappings = function(prompt_bufnr, map)
                        actions.select_default:replace(function()
                            actions.close(prompt_bufnr)
                            local selection = action_state.get_selected_entry()
                            
                            vim.ui.input({ prompt = "Debate description: " }, function(desc)
                                if desc then
                                    M._start_template_debate(selection.value.id, desc)
                                end
                            end)
                        end)
                        return true
                    end,
                }):find()
            end)
        end,
    })
end

function M._start_template_debate(template_id, description)
    local context = vim.api.nvim_buf_get_lines(0, 0, -1, false)
    local file_path = vim.fn.expand("%:p")
    
    local body = vim.fn.json_encode({
        task = {
            description = description,
            files = { file_path },
            context = table.concat(context, "\n"):sub(1, 10000),
        }
    })
    
    vim.notify("Starting template debate...", vim.log.levels.INFO)
    
    curl.post(aios.config.hub_url .. "/api/debate-templates/" .. template_id .. "/debate", {
        body = body,
        headers = { ["Content-Type"] = "application/json" },
        callback = function(response)
            vim.schedule(function()
                if response.status >= 200 and response.status < 300 then
                    local result = vim.fn.json_decode(response.body)
                    aios._show_debate_result(result.result or result)
                else
                    vim.notify("Template debate failed", vim.log.levels.ERROR)
                end
            end)
        end,
    })
end

function M.supervisor_analytics(opts)
    opts = opts or {}
    
    curl.get(aios.config.hub_url .. "/api/supervisor-analytics/rankings", {
        callback = function(response)
            vim.schedule(function()
                if response.status ~= 200 then
                    vim.notify("Failed to fetch rankings", vim.log.levels.ERROR)
                    return
                end
                
                local data = vim.fn.json_decode(response.body)
                
                pickers.new(opts, {
                    prompt_title = "AIOS Supervisor Rankings",
                    finder = finders.new_table({
                        results = data.rankings,
                        entry_maker = function(entry)
                            local display = string.format(
                                "%s | Votes: %d | Confidence: %.2f | Approval: %.1f%%",
                                entry.name,
                                entry.totalVotes or 0,
                                entry.avgConfidence or 0,
                                entry.approvalRate or 0
                            )
                            return {
                                value = entry,
                                display = display,
                                ordinal = entry.name,
                            }
                        end,
                    }),
                    sorter = conf.generic_sorter(opts),
                    attach_mappings = function(prompt_bufnr, map)
                        actions.select_default:replace(function()
                            actions.close(prompt_bufnr)
                            local selection = action_state.get_selected_entry()
                            vim.notify("Selected: " .. selection.value.name, vim.log.levels.INFO)
                        end)
                        return true
                    end,
                }):find()
            end)
        end,
    })
end

function M.architect_sessions(opts)
    opts = opts or {}
    
    curl.get(aios.config.hub_url .. "/api/architect/sessions", {
        callback = function(response)
            vim.schedule(function()
                if response.status ~= 200 then
                    vim.notify("Failed to fetch sessions", vim.log.levels.ERROR)
                    return
                end
                
                local data = vim.fn.json_decode(response.body)
                
                pickers.new(opts, {
                    prompt_title = "AIOS Architect Sessions",
                    finder = finders.new_table({
                        results = data.sessions or {},
                        entry_maker = function(entry)
                            local display = string.format(
                                "[%s] %s - %s",
                                entry.status or "unknown",
                                entry.id or "N/A",
                                (entry.task or ""):sub(1, 50)
                            )
                            return {
                                value = entry,
                                display = display,
                                ordinal = entry.id .. " " .. (entry.task or ""),
                            }
                        end,
                    }),
                    sorter = conf.generic_sorter(opts),
                    attach_mappings = function(prompt_bufnr, map)
                        actions.select_default:replace(function()
                            actions.close(prompt_bufnr)
                            local selection = action_state.get_selected_entry()
                            aios._show_architect_session(selection.value)
                        end)
                        return true
                    end,
                }):find()
            end)
        end,
    })
end

return M
