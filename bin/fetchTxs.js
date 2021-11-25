/**
 * Fetches all transactions concerning an account starting from given
 * transaction hash. It prints them into stdout as JSON lines.
 *
 * We use the https://solscan.io APIs.
 *
 * Usage:
 *
 * ```
 * node bin/fetchTxs.json "PROGRAM_PUBKEY" "ZEROTH_TRANSACTION_HASH" > output.jsonl
 * ```
 */

const fetch = require("node-fetch");

const address = process.argv[2];
const userAgent =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:94.0) Gecko/20100101 Firefox/94.0";

async function getTransactionsSince(tx) {
  const res = await fetch(
    `https://api.solscan.io/account/transaction?address=${address}&before=${tx}`,
    {
      credentials: "omit",
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en;q=0.5",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
      },
      referrer: "https://solscan.io/",
      method: "GET",
      mode: "cors",
    }
  );
  const json = await res.json();

  // typo in their APIs
  if (!json.succcess && !json.success) {
    throw new Error(`Cannot fetch data from tx ${tx}`);
  }

  return json.data;
}

async function main() {
  const start = process.argv[3];
  let next = start;

  try {
    // stop it with Ctrl+C
    while (true) {
      const newTxs = await getTransactionsSince(next);

      if (newTxs.length === 0) {
        throw new Error("No transaction received after", next);
      }
      next = newTxs[newTxs.length - 1].txHash;

      newTxs.forEach((tx) => console.log(JSON.stringify(tx)));

      // avoid getting blocked
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (e) {
    console.error("Cannot fetch more transaction:", e);
  }
}

main();
