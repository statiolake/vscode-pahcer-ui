-- make run compile でコンパイルできるように設定する
vim.cmd.compiler("tsc")
vim.opt.makeprg = "npm"
