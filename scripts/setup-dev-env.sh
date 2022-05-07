#!/bin/bash

if ! which asdf >/dev/null 2>&1; then
  echo "Please install asdf; see https://asdf-vm.com/guide/getting-started.html"
  exit 1
fi

for plugin in $(cat .tool-versions | cut -d' ' -f 1); do
  asdf plugin add $plugin 
done

asdf install
