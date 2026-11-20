# sandbox

使い捨てのコードの置き場。本体(apps/)からは参照しない。確認が済んだら、ディレクトリごと削除する。

- `smoke/`: ローカルの疎通確認用。Expo(Web)→ cognito-local でサインイン → Lambda(sam local start-api)→ DynamoDB Local と TiDB に読み書き。手順はルートの README の「疎通確認アプリ」を参照。
