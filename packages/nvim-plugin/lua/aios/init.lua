local M = {}

M.config = {
    hub_url = "http://localhost:3000",
    auto_connect = false,
    keymaps = {
        debate = "<leader>ad",
        architect = "<leader>aa",
        analytics = "<leader>as",
        templates = "<leader>at",
    },
}

local curl = require("plenary.curl")

function M.setup(opts)
    M.config = vim.tbl_deep_extend("force", M.config, opts or {})
    
    vim.api.nvim_create_user_command("AiosDebate", function(args)
        M.start_debate(args.args)
    end, { nargs = "?" })
    
    vim.api.nvim_create_user_command("AiosArchitect", function(args)
        M.start_architect(args.args)
    end, { nargs = "?" })
    
    vim.api.nvim_create_user_command("AiosAnalytics", M.show_analytics, {})
    vim.api.nvim_create_user_command("AiosTemplates", M.show_templates, {})
    vim.api.nvim_create_user_command("AiosHealth", M.check_health, {})
    
    if M.config.keymaps then
        local km = M.config.keymaps
        if km.debate then
            vim.keymap.set("n", km.debate, M.start_debate, { desc = "AIOS: Start Debate" })
            vim.keymap.set("v", km.debate, M.start_debate_visual, { desc = "AIOS: Debate Selection" })
        end
        if km.architect then
            vim.keymap.set("n", km.architect, M.start_architect, { desc = "AIOS: Architect Mode" })
        end
        if km.analytics then
            vim.keymap.set("n", km.analytics, M.show_analytics, { desc = "AIOS: Show Analytics" })
        end
        if km.templates then
            vim.keymap.set("n", km.templates, M.show_templates, { desc = "AIOS: Show Templates" })
        end
    end
end

function M.start_debate(description)
    if not description or description == "" then
        vim.ui.input({ prompt = "Debate description: " }, function(input)
            if input then M._do_debate(input) end
        end)
    else
        M._do_debate(description)
    end
end

function M.start_debate_visual()
    local lines = vim.fn.getline("'<", "'>")
    local context = table.concat(lines, "\n")
    
    vim.ui.input({ prompt = "Debate description: " }, function(input)
        if input then M._do_debate(input, context) end
    end)
end

function M._do_debate(description, context)
    context = context or vim.api.nvim_buf_get_lines(0, 0, -1, false)
    if type(context) == "table" then
        context = table.concat(context, "\n")
    end
    
    local file_path = vim.fn.expand("%:p")
    
    local body = vim.fn.json_encode({
        task = {
            id = "nvim-" .. os.time(),
            description = description,
            files = { file_path },
            context = context:sub(1, 10000),
        }
    })
    
    vim.notify("Starting council debate...", vim.log.levels.INFO)
    
    curl.post(M.config.hub_url .. "/api/council/debate", {
        body = body,
        headers = { ["Content-Type"] = "application/json" },
        callback = function(response)
            vim.schedule(function()
                if response.status == 200 then
                    local result = vim.fn.json_decode(response.body)
                    M._show_debate_result(result)
                else
                    vim.notify("Debate failed: " .. response.status, vim.log.levels.ERROR)
                end
            end)
        end,
    })
end

function M._show_debate_result(result)
    local buf = vim.api.nvim_create_buf(false, true)
    
    local lines = {
        "# Council Debate Result",
        "",
        "**Decision:** " .. (result.decision or "N/A"),
        "**Consensus:** " .. string.format("%.1f%%", result.consensusLevel or 0),
        "",
        "## Reasoning",
        result.reasoning or "No reasoning provided",
        "",
        "## Votes",
    }
    
    if result.votes then
        for _, vote in ipairs(result.votes) do
            table.insert(lines, string.format("- %s: %s (%.0f%% confidence)", 
                vote.supervisor, vote.vote, (vote.confidence or 0) * 100))
        end
    end
    
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
    vim.api.nvim_buf_set_option(buf, "filetype", "markdown")
    vim.api.nvim_buf_set_option(buf, "modifiable", false)
    
    vim.cmd("vsplit")
    vim.api.nvim_win_set_buf(0, buf)
end

function M.start_architect(task)
    if not task or task == "" then
        vim.ui.input({ prompt = "Architect task: " }, function(input)
            if input then M._do_architect(input) end
        end)
    else
        M._do_architect(task)
    end
end

function M._do_architect(task)
    local body = vim.fn.json_encode({ task = task })
    
    vim.notify("Starting architect session...", vim.log.levels.INFO)
    
    curl.post(M.config.hub_url .. "/api/architect/sessions", {
        body = body,
        headers = { ["Content-Type"] = "application/json" },
        callback = function(response)
            vim.schedule(function()
                if response.status >= 200 and response.status < 300 then
                    local session = vim.fn.json_decode(response.body)
                    M._show_architect_session(session)
                else
                    vim.notify("Architect failed: " .. response.status, vim.log.levels.ERROR)
                end
            end)
        end,
    })
end

function M._show_architect_session(session)
    local buf = vim.api.nvim_create_buf(false, true)
    
    local lines = {
        "# Architect Session",
        "",
        "**Session ID:** " .. (session.sessionId or "N/A"),
        "**Status:** " .. (session.status or "N/A"),
        "",
        "## Reasoning Output",
        session.reasoningOutput or "Reasoning in progress...",
    }
    
    if session.plan then
        table.insert(lines, "")
        table.insert(lines, "## Edit Plan")
        table.insert(lines, "**Description:** " .. (session.plan.description or "N/A"))
        table.insert(lines, "**Complexity:** " .. (session.plan.complexity or "N/A"))
        
        if session.plan.files then
            table.insert(lines, "")
            table.insert(lines, "### Files")
            for _, file in ipairs(session.plan.files) do
                table.insert(lines, "- " .. file)
            end
        end
    end
    
    vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
    vim.api.nvim_buf_set_option(buf, "filetype", "markdown")
    vim.api.nvim_buf_set_option(buf, "modifiable", false)
    
    vim.cmd("vsplit")
    vim.api.nvim_win_set_buf(0, buf)
    
    vim.ui.select({ "Approve", "Reject", "Cancel" }, { prompt = "Plan action:" }, function(choice)
        if choice == "Approve" then
            M._approve_plan(session.sessionId)
        elseif choice == "Reject" then
            M._reject_plan(session.sessionId)
        end
    end)
end

function M._approve_plan(session_id)
    curl.post(M.config.hub_url .. "/api/architect/sessions/" .. session_id .. "/approve", {
        callback = function(response)
            vim.schedule(function()
                if response.status >= 200 and response.status < 300 then
                    vim.notify("Plan approved!", vim.log.levels.INFO)
                else
                    vim.notify("Approval failed", vim.log.levels.ERROR)
                end
            end)
        end,
    })
end

function M._reject_plan(session_id)
    curl.post(M.config.hub_url .. "/api/architect/sessions/" .. session_id .. "/reject", {
        callback = function(response)
            vim.schedule(function()
                if response.status >= 200 and response.status < 300 then
                    vim.notify("Plan rejected", vim.log.levels.INFO)
                else
                    vim.notify("Rejection failed", vim.log.levels.ERROR)
                end
            end)
        end,
    })
end

function M.show_analytics()
    curl.get(M.config.hub_url .. "/api/supervisor-analytics/summary", {
        callback = function(response)
            vim.schedule(function()
                if response.status == 200 then
                    local data = vim.fn.json_decode(response.body)
                    local s = data.summary
                    
                    local msg = string.format(
                        "Supervisors: %d | Debates: %d | Approved: %d | Rejected: %d | Consensus: %.1f%%",
                        s.totalSupervisors or 0,
                        s.totalDebates or 0,
                        s.totalApproved or 0,
                        s.totalRejected or 0,
                        s.avgConsensus or 0
                    )
                    vim.notify(msg, vim.log.levels.INFO)
                else
                    vim.notify("Failed to fetch analytics", vim.log.levels.ERROR)
                end
            end)
        end,
    })
end

function M.show_templates()
    curl.get(M.config.hub_url .. "/api/debate-templates", {
        callback = function(response)
            vim.schedule(function()
                if response.status == 200 then
                    local data = vim.fn.json_decode(response.body)
                    local items = {}
                    
                    for _, t in ipairs(data.templates) do
                        table.insert(items, t.name .. " (" .. t.id .. ")")
                    end
                    
                    vim.ui.select(items, { prompt = "Select template:" }, function(choice)
                        if choice then
                            vim.notify("Selected: " .. choice, vim.log.levels.INFO)
                        end
                    end)
                else
                    vim.notify("Failed to fetch templates", vim.log.levels.ERROR)
                end
            end)
        end,
    })
end

function M.check_health()
    curl.get(M.config.hub_url .. "/api/health", {
        callback = function(response)
            vim.schedule(function()
                if response.status == 200 then
                    vim.notify("AIOS Hub is healthy", vim.log.levels.INFO)
                else
                    vim.notify("AIOS Hub is not responding", vim.log.levels.WARN)
                end
            end)
        end,
    })
end

return M
