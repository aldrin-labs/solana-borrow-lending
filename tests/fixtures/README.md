# fixtures

To refresh pyth.network oracle accounts, fetch their data them via:

```shell
solana config set --url https://api.devnet.solana.com

# Pyth product: SRM/USD
solana account 6MEwdxe4g1NeAF9u6KDG14anJpFsVEa2cvr5H6iriFZ8 --output-file srm_usd_product.bin
# Pyth price: SRM/USD
solana account 992moaMQKs32GKZ9dxi8keyM2bUmbrwBZpK4p2K6X5Vs --output-file srm_usd_price.bin
```
