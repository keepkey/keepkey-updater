// See: https://medium.com/@TwitterArchiveEraser/notarize-electron-apps-7a5f988406db

const fs = require('fs');
const path = require('path');
var electron_notarize = require('electron-notarize');

module.exports = async function (params) {
    // Only notarize the app on Mac OS.
    if (params.electronPlatformName !== 'darwin') {
        return;
    }

    console.log('afterSign hook triggered', params);

    let appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
    if (!fs.existsSync(appPath)) {
        throw new Error(`Cannot find application at: ${appPath}`);
    }

    console.log(`Notarizing ${appPath}`);

    await electron_notarize.notarize({
        tool: 'notarytool',
        appPath,
        appleApiKey: process.env.APPLE_API_KEY,
        appleApiKeyId: process.env.APPLE_API_KEY_ID,
        appleApiIssuer: process.env.APPLE_API_ISSUER,
    });

    console.log(`Done notarizing`);
};
