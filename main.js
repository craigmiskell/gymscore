const { app, BrowserWindow} = require("electron");
const path = require("path");
const isDev = require("electron-is-dev");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile("index.html");
  // TODO: we'll add a menu again later when we have a need
  win.setMenu(null);
  if(isDev) {
    win.webContents.openDevTools();
  }
};

app.whenReady().then(() => {
  createWindow();

  // Recommended boilerplate to recreate a window when activated
  // which gives the expected UX on OSX
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {createWindow();}
  });
});

// Recommended boiler-plate to quit the app when all windows are closed
// except for OSX (see on activate above)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {app.quit();}
});
