#!/bin/bash -e
KEYPATH="$1"
JWT="$2"

if [ ! -f "$KEYPATH" ] || [ -z "$JWT" ]; then
  printf 'Usage: %s <keyfile> <JWT>\n' "$(basename "$0")" 1>&2
  exit 1
fi

echo "Adding directory to local IPFS node..."
CID="$(ipfs add -Qr "$(dirname "$0")/firmware")"
echo "Directory added, CID: $CID"

KEYNAME="keepkey-updater-$RANDOM-$RANDOM-$RANDOM"
echo "Importing IPNS key..."
ipfs key import "$KEYNAME" "$1" 1>/dev/null
echo "Publishing IPNS name..."
ipfs name publish "--key=$KEYNAME" "/ipfs/$CID" || {
  echo "IPNS update failed!" 1>&2
  echo "Removing IPNS key..."
  ipfs key rm "$KEYNAME" 1>/dev/null
  exit 1
}
echo "Removing IPNS key..."
ipfs key rm "$KEYNAME" 1>/dev/null

echo "Uploading to web3.storage..."
ipfs dag export "$CID" | curl --progress-bar -X POST -H "Content-Type: application/car" -H "Authorization: Bearer $JWT" --data-binary '@-' https://api.web3.storage/car | jq '.'

echo "Done."
