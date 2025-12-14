-- make run compile でコンパイルできるように設定する
vim.api.nvim_create_autocmd("FileType", {
	pattern = "typescript",
	callback = function()
		vim.cmd.compiler("tsc")
		vim.opt_local.makeprg = "npm"
	end,
})
