'use strict'

import fs from 'fs'
import path from 'path'
import { BrowserWindow, app, screen } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { isMarkdownFile } from './utils'

export const windows = new Map()

const ensureWindowPosition = mainWindowState => {
  let { x, y, width, height } = mainWindowState
  let center = false
  if (x === undefined || y === undefined) {
    center = true
  } else {
    center = !screen.getAllDisplays().map(display =>
      x >= display.bounds.x && x <= display.bounds.x + display.bounds.width &&
      y >= display.bounds.y && y <= display.bounds.y + display.bounds.height)
      .some(display => display)
  }
  if (center) {
    // win.center() and "workArea" doesn't work on Linux
    const screenArea = process.platform === 'linux' ? screen.getPrimaryDisplay().bounds : screen.getPrimaryDisplay().workArea
    x = Math.ceil(screenArea.x + (screenArea.width - width) / 2)
    y = Math.ceil(screenArea.y + (screenArea.height - height) / 2)
  }
  return {
    x,
    y,
    width,
    height
  }
}

const createWindow = (pathname, options = {}) => {
  const TITLE_BAR_HEIGHT = 21
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1200,
    defaultHeight: 800
  })

  const { x, y, width, height } = ensureWindowPosition(mainWindowState)
  const winOpt = Object.assign({ x, y, width, height }, {
    icon: path.join(__static, 'logo-96px.png'),
    minWidth: 450,
    minHeight: 220,
    webPreferences: {
      webSecurity: false
    },
    useContentSize: true,
    show: false,
    frame: false,
    titleBarStyle: 'hidden'
  }, options)
  let win = new BrowserWindow(winOpt)
  mainWindowState.manage(win)

  const winURL = process.env.NODE_ENV === 'development'
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`

  win.loadURL(winURL)
  win.setSheetOffset(TITLE_BAR_HEIGHT) // 21 is the title bar height
  win.once('ready-to-show', () => {
    win.show()

    if (pathname && isMarkdownFile(pathname)) {
      app.addRecentDocument(pathname)
      const filename = path.basename(pathname)
      fs.readFile(path.resolve(pathname), 'utf-8', (err, file) => {
        if (err) return console.log(err)
        win.webContents.send('AGANI::file-loaded', {
          file,
          filename,
          pathname
        })
      })
    }
  })

  win.on('focus', () => {
    win.webContents.send('AGANI::window-active-status', { status: true })
  })

  win.on('blur', () => {
    win.webContents.send('AGANI::window-active-status', { status: false })
  })

  win.on('close', event => { // before closed
    event.preventDefault()
    win.webContents.send('AGANI::ask-for-close')
  })

  windows.set(win.id, win)
  return win
}

export default createWindow
