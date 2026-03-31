#!/bin/bash

if ! which asdf >/dev/null 2>&1; then
  echo "Please install asdf; see https://asdf-vm.com/guide/getting-started.html"
  exit 1
fi

echo "==> Installing OS packages for release tooling (pandoc, weasyprint)"
sudo apt-get install -y pandoc weasyprint

cut -d' ' -f 1 <.tool-versions | while read -r plugin; do
  asdf plugin add "${plugin}"
done

asdf install

pre-commit install
