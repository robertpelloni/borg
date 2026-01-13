if vim.g.loaded_aios then
    return
end
vim.g.loaded_aios = true

vim.api.nvim_create_user_command("AiosSetup", function()
    require("aios").setup()
end, { desc = "Setup AIOS plugin" })
