# Development

## Environment setup

After checking out the repo:

1. Install [asdf](https://asdf-vm.com/guide/getting-started.html)
1. Run ./scripts/update-dev-env.sh to install required plugins and versions
1. Install NPM modules:

   ```shell
   npm install
   ```

## Tasks

### Running in dev

With hot reload:

```shell
npm run dev
```

Clean build, no hot reload (not recommended, just kept for history)

```shell
npm start
```

See package.json for job/script definitions

### Style

To check style:

```shell
npm run eslint
```

To check and *fix* style automatically where possible:

```shell
npm run eslintfix
```

TODO: precommit with autofix

To check markdown style:

```shell
npm run mdlint
```

## Licenses

The app is licensed under GPLv3 or later, which may constrain which libraries can be used.  Verify that all
*production* modules are compatible with

```shell
npm exec license-check
```

The list of acceptable licenses is configured in the license-check script command in package.json.  If
non-listed licenses show up, license-check will fail; check the license and if it is compatible with GPLv3
(see the [license list](http://www.gnu.org/licenses/license-list.html) for guidance) then add it to the
list.  If it is not, find an alternative or rewrite as needed.

The license-check does not need to be performend on development-only modules because we are not further
distributing them, they are only pulled *by* the developer into their development environment, i.e. someone
else has distributed them to the developer and is responsible for ensuring the distribution is legal, and
they are then used locally for development purposes.

To update the list for display in the UI, run

```shell
npm exec generate-licenses
```

## Releasing a new version

Versioning follows [Conventional Commits](https://www.conventionalcommits.org/): commit messages prefixed with
`fix:` trigger a patch bump, `feat:` triggers a minor bump, and `BREAKING CHANGE:` in the footer triggers a
major bump.

When ready to cut a release, run:

```shell
npm run release
```

This will:

1. Determine the new version from commits since the last tag
2. Update `version` in `package.json`
3. Update `CHANGELOG.md`
4. Commit both files
5. Create a git tag (e.g. `v0.9.1`)

To override the version bump type (e.g. to force a minor or major bump regardless of commits):

```shell
npm run release:minor
npm run release:major
```

After releasing, push the commit and tag:

```shell
git push --follow-tags
```

## Building for distribution

Run the make command for your choice of target OS.

```shell
npm run make-{linux,osx,windows}
```

The results will be a directory in `out/gymscore-<platform>-<arch>`; packing for distribution beyond that is
not yet tested or documented.

### Windows, from Linux

Electron-builder works without mono et al, and is far quicker than electron-forge which requires mono and ends up
rebuilding all manner of things.  It still takes a hot minute to sign with signtool, but I was unable to find the
incantation to disable that.

To build an ISO image to mount on a network-disconnected VM that one might be using to test:

```shell
version=$(jq -r .version package.json)
genisoimage -o out/iso/gymscore-${version}.iso "out/gymscore ${version}.exe"
```
