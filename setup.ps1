   npm install
   npm install -g typescript-language-server typescript

   foreach ($p in "typescript-lsp","commit-commands","vercel","context7") {
     claude plugin install "$p@claude-plugins-official" --scope project
   }