/*
 * electron-builder afterPack hook.
 *
 * Runs after the .app bundle is laid down, before the .dmg is built.
 * Performs an ad-hoc codesign of the entire bundle (`--sign -`), which:
 *   - Avoids macOS "is damaged and can't be opened" Gatekeeper message
 *     (that message is what users see when a quarantined .app has no
 *     code signature at all on the bundle resources)
 *   - Replaces it with the friendlier "developer cannot be verified" prompt
 *     that supports the right-click → Open bypass
 *
 * Ad-hoc signing does NOT use any Apple Developer ID — keeps the build
 * fully anonymous (no email or team ID embedded in the signature).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  const entitlements = path.join(__dirname, 'entitlements.mac.plist');

  const entFlag = fs.existsSync(entitlements)
    ? `--entitlements ${JSON.stringify(entitlements)}`
    : '';

  // Step 1 — sign every nested binary so the deep walk succeeds.
  // electron-builder leaves the .app un-signed when identity isn't a keychain id;
  // we run a from-scratch deep ad-hoc sign here ourselves.
  const cmd = `codesign --force --deep --options runtime ${entFlag} --sign - ${JSON.stringify(appPath)}`;
  console.log(`[afterPack] ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });

  // Step 2 — verify
  try {
    execSync(`codesign --verify --deep --strict ${JSON.stringify(appPath)}`, { stdio: 'inherit' });
    console.log('[afterPack] codesign verify passed');
  } catch (e) {
    console.warn('[afterPack] codesign verify warning:', e.message);
  }
};
