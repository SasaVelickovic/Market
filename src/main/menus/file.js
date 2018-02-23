import * as actions from '../actions/file'

export default {
  label: 'File',
  submenu: [{
    label: 'New File',
    accelerator: 'CmdOrCtrl+N',
    click (menuItem, browserWindow) {
      actions.newFile()
    }
  }, {
    label: 'Open...',
    accelerator: 'CmdOrCtrl+O',
    click (menuItem, browserWindow) {
      actions.open(browserWindow)
    }
  }, {
    role: 'recentdocuments',
    submenu: [
      {
        role: 'clearrecentdocuments'
      }
    ]
  }, {
    type: 'separator'
  }, {
    label: 'Save',
    accelerator: 'CmdOrCtrl+S',
    click (menuItem, browserWindow) {
      actions.save(browserWindow)
    }
  }, {
    label: 'Save As...',
    accelerator: 'Shift+CmdOrCtrl+S',
    click (menuItem, browserWindow) {
      actions.saveAs(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Export',
    submenu: [{
      label: 'Export Styled HTML',
      click (menuItem, browserWindow) {
        actions.exportHTML(browserWindow, true)
      }
    }, {
      label: 'Export HTML',
      click (menuItem, browserWindow) {
        actions.exportHTML(browserWindow, false)
      }
    }]
  }, {
    type: 'separator'
  }, {
    label: 'Print',
    accelerator: 'CmdOrCtrl+P',
    click: function () {}
  }]
}
