import { ipcRenderer } from 'electron'
import path from 'path'
import bus from '../bus'
import { getOptionsFromState, getSingleFileState, getBlankFileState } from './help'

const state = {
  currentFile: {},
  tabs: []
}

const getters = {}

const mutations = {
  // set search key and matches also index
  SET_SEARCH (state, value) {
    state.currentFile.searchMatches = value
  },
  SET_CURRENT_FILE (state, currentFile) {
    const oldCurrentFile = state.currentFile
    if (!oldCurrentFile.id || oldCurrentFile.id !== currentFile.id) {
      const { markdown, cursor, history } = currentFile
      // set state first, then emit file changed event
      state.currentFile = currentFile
      bus.$emit('file-changed', { markdown, cursor, renderCursor: true, history })
    }
  },
  ADD_FILE_TO_TABS (state, currentFile) {
    state.tabs.push(currentFile)
  },
  REMOVE_FILE_WITHIN_TABS (state, file) {
    const { tabs, currentFile } = state
    const index = tabs.indexOf(file)
    tabs.splice(index, 1)
    state.tabs = tabs
    if (file.id === currentFile.id) {
      const fileState = state.tabs[index] || state.tabs[index - 1] || {}
      state.currentFile = fileState
      if (typeof fileState.markdown === 'string') {
        const { markdown, cursor, history } = fileState
        bus.$emit('file-changed', { markdown, cursor, renderCursor: true, history })
      }
    }
  },
  SET_PATHNAME (state, file) {
    const { filename, pathname, id } = file
    window.__dirname = path.dirname(pathname)

    const targetFile = state.tabs.filter(f => f.id === id)[0]
    if (targetFile) {
      const isSaved = true
      Object.assign(targetFile, { filename, pathname, isSaved })
    }
  },
  SET_SAVE_STATUS (state, status) {
    state.currentFile.isSaved = status
  },
  SET_SAVE_STATUS_WHEN_REMOVE (state, { pathname }) {
    state.tabs.forEach(f => {
      if (f.pathname === pathname) {
        f.isSaved = false
      }
    })
  },
  SET_MARKDOWN (state, markdown) {
    state.currentFile.markdown = markdown
  },
  SET_IS_UTF8_BOM_ENCODED (state, isUtf8BomEncoded) {
    state.currentFile.isUtf8BomEncoded = isUtf8BomEncoded
  },
  SET_LINE_ENDING (state, lineEnding) {
    state.currentFile.lineEnding = lineEnding
  },
  SET_ADJUST_LINE_ENDING_ON_SAVE (state, adjustLineEndingOnSave) {
    state.currentFile.adjustLineEndingOnSave = adjustLineEndingOnSave
  },
  SET_WORD_COUNT (state, wordCount) {
    state.currentFile.wordCount = wordCount
  },
  SET_CURSOR (state, cursor) {
    state.currentFile.cursor = cursor
  },
  SET_HISTORY (state, history) {
    state.currentFile.history = history
  },
  CLOSE_ALL_TABS (state) {
    state.tabs = []
    state.currentFile = {}
  },
  RENAME_IF_NEEDED (state, { src, dest }) {
    const { tabs } = state
    tabs.forEach(f => {
      if (f.pathname === src) {
        f.pathname = dest
        f.filename = path.basename(dest)
      }
    })
  }
}

const actions = {
  // when cursor in `![](cursor)`, insert image popup will be shown! `absolute` or `relative`
  ASK_FOR_INSERT_IMAGE ({ commit }, type) {
    ipcRenderer.send('AGANI::ask-for-insert-image', type)
  },
  // image path auto complement
  ASK_FOR_IMAGE_AUTO_PATH ({ commit, state }, src) {
    const { pathname } = state.currentFile
    if (pathname) {
      ipcRenderer.send('AGANI::ask-for-image-auto-path', { pathname, src })
    }
  },

  SEARCH ({ commit }, value) {
    commit('SET_SEARCH', value)
  },

  REMOVE_FILE_IN_TABS ({ commit }, file) {
    commit('REMOVE_FILE_WITHIN_TABS', file)
  },

  // need update line ending when change between windows.
  LISTEN_FOR_LINEENDING_MENU ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::req-update-line-ending-menu', e => {
      dispatch('UPDATE_LINEENDING_MENU')
    })
  },

  // need update line ending when change between tabs
  UPDATE_LINEENDING_MENU ({ commit, state }) {
    const { lineEnding } = state.currentFile
    ipcRenderer.send('AGANI::update-line-ending-menu', lineEnding)
  },

  // need pass some data to main process when `save` menu item clicked
  LISTEN_FOR_SAVE ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save', () => {
      const { id, pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state.currentFile)
      ipcRenderer.send('AGANI::response-file-save', { id, pathname, markdown, options })
    })
  },

  // need pass some data to main process when `save as` menu item clicked
  LISTEN_FOR_SAVE_AS ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save-as', () => {
      const { id, pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state.currentFile)
      ipcRenderer.send('AGANI::response-file-save-as', { id, pathname, markdown, options })
    })
  },

  LISTEN_FOR_SET_PATHNAME ({ commit }) {
    ipcRenderer.on('AGANI::set-pathname', (e, file) => {
      commit('SET_PATHNAME', file)
    })
  },

  LISTEN_FOR_CLOSE ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-for-close', e => {
      const unSavedFiles = state.tabs.filter(file => !(file.isSaved && /[^\n]/.test(file.markdown)))
        .map(file => {
          const { id, filename, pathname, markdown } = file
          const options = getOptionsFromState(file)
          return { id, filename, pathname, markdown, options }
        })

      if (unSavedFiles.length) {
        ipcRenderer.send('AGANI::response-close-confirm', unSavedFiles)
      } else {
        ipcRenderer.send('AGANI::close-window')
      }
    })
  },

  LISTEN_FOR_SAVE_ALL_CLOSE ({ commit, state }) {
    ipcRenderer.on('AGANI::save-all-response', (e, err) => {
      if (err) console.log(err)
      else {
        commit('CLOSE_ALL_TABS')
      }
    })
  },

  ASK_FOR_SAVE_ALL ({ commit, state }, isClose) {
    const unSavedFiles = state.tabs.filter(file => !(file.isSaved && /[^\n]/.test(file.markdown)))
      .map(file => {
        const { id, filename, pathname, markdown } = file
        const options = getOptionsFromState(file)
        return { id, filename, pathname, markdown, options }
      })
    if (unSavedFiles.length) {
      const EVENT_NAME = isClose ? 'AGANI::save-all-close' : 'AGANI::save-all'
      ipcRenderer.send(EVENT_NAME, unSavedFiles)
    }
  },

  LISTEN_FOR_MOVE_TO ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-move-to', () => {
      const { id, pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state.currentFile)
      if (!pathname) {
        // if current file is a newly created file, just save it!
        ipcRenderer.send('AGANI::response-file-save', { id, pathname, markdown, options })
      } else {
        // if not, move to a new(maybe) folder
        ipcRenderer.send('AGANI::response-file-move-to', { id, pathname })
      }
    })
  },

  LISTEN_FOR_RENAME ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::ask-file-rename', () => {
      dispatch('RESPONSE_FOR_RENAME')
    })
  },

  RESPONSE_FOR_RENAME ({ commit, state }) {
    const { id, pathname, markdown } = state.currentFile
    const options = getOptionsFromState(state.currentFile)
    if (!pathname) {
      // if current file is a newly created file, just save it!
      ipcRenderer.send('AGANI::response-file-save', { id, pathname, markdown, options })
    } else {
      bus.$emit('rename')
    }
  },

  // ask for main process to rename this file to a new name `newFilename`
  RENAME ({ commit, state }, newFilename) {
    const { pathname, filename } = state.currentFile
    if (filename !== newFilename) {
      const newPathname = path.join(path.dirname(pathname), newFilename)
      ipcRenderer.send('AGANI::rename', { pathname, newPathname })
    }
  },

  UPDATE_CURRENT_FILE ({ commit, state }, currentFile) {
    commit('SET_CURRENT_FILE', currentFile)
    const { tabs } = state
    if (!tabs.some(file => file.id === currentFile.id)) {
      commit('ADD_FILE_TO_TABS', currentFile)
    }
  },

  LISTEN_FOR_OPEN_SINGLE_FILE ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::open-single-file', (e, { markdown, filename, pathname, options }) => {
      const fileState = getSingleFileState({ markdown, filename, pathname, options })
      dispatch('UPDATE_CURRENT_FILE', fileState)
      bus.$emit('file-loaded', markdown)
      commit('SET_LAYOUT', {
        rightColumn: '',
        showToolBar: false,
        showTabBar: false
      })
      dispatch('SET_LAYOUT_MENU_ITEM')
    })
  },

  LISTEN_FOR_OPEN_BLANK_WINDOW ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::open-blank-window', (e, { lineEnding }) => {
      const { tabs } = state
      const fileState = getBlankFileState(tabs, lineEnding)
      const { markdown } = fileState
      dispatch('UPDATE_CURRENT_FILE', fileState)
      bus.$emit('file-loaded', markdown)
      commit('SET_LAYOUT', {
        rightColumn: '',
        showToolBar: false,
        showTabBar: false
      })
      dispatch('SET_LAYOUT_MENU_ITEM')
    })
  },

  // LISTEN_FOR_FILE_CHANGE ({ commit, state }) {
  //   ipcRenderer.on('AGANI::file-change', (e, { file, filename, pathname }) => {
  //     const { windowActive } = state
  //     commit('SET_FILENAME', filename)
  //     commit('SET_PATHNAME', pathname)
  //     commit('SET_MARKDOWN', file)
  //     commit('SET_SAVE_STATUS', true)
  //     if (!windowActive) {
  //       bus.$emit('file-loaded', file)
  //     }
  //   })
  // },

  // Content change from realtime preview editor and source code editor
  LISTEN_FOR_CONTENT_CHANGE ({ commit, state, rootState }, { markdown, wordCount, cursor, history }) {
    const { autoSave } = rootState.preferences
    const { pathname, markdown: oldMarkdown, id } = state.currentFile
    const options = getOptionsFromState(state.currentFile)
    commit('SET_MARKDOWN', markdown)
    // set word count
    if (wordCount) commit('SET_WORD_COUNT', wordCount)
    // set cursor
    if (cursor) commit('SET_CURSOR', cursor)
    // set history
    if (history) commit('SET_HISTORY', history)
    // change save status/save to file only when the markdown changed!
    if (markdown !== oldMarkdown) {
      if (pathname && autoSave) {
        ipcRenderer.send('AGANI::response-file-save', { id, pathname, markdown, options })
      } else {
        commit('SET_SAVE_STATUS', false)
      }
    }
  },

  SELECTION_CHANGE ({ commit }, changes) {
    const { start, end } = changes
    if (start.key === end.key && start.block.text) {
      const value = start.block.text.substring(start.offset, end.offset)
      commit('SET_SEARCH', {
        matches: [],
        index: -1,
        value
      })
    }

    ipcRenderer.send('AGANI::selection-change', changes)
  },

  SELECTION_FORMATS ({ commit }, formats) {
    ipcRenderer.send('AGANI::selection-formats', formats)
  },

  // listen for export from main process
  LISTEN_FOR_EXPORT ({ commit, state }) {
    ipcRenderer.on('AGANI::export', (e, { type }) => {
      bus.$emit('export', type)
    })
  },

  EXPORT ({ commit, state }, { type, content }) {
    const { filename, pathname } = state.currentFile
    ipcRenderer.send('AGANI::response-export', { type, content, filename, pathname })
  },

  LISTEN_FOR_INSERT_IMAGE ({ commit, state }) {
    ipcRenderer.on('AGANI::INSERT_IMAGE', (e, { filename: imagePath, type }) => {
      if (type === 'absolute' || type === 'relative') {
        const { pathname } = state.currentFile
        if (type === 'relative' && pathname) {
          imagePath = path.relative(path.dirname(pathname), imagePath)
        }
        bus.$emit('insert-image', imagePath)
      } else {
        // upload to CM
        bus.$emit('upload-image')
      }
    })
  },

  LINTEN_FOR_SET_LINE_ENDING ({ commit, state }) {
    ipcRenderer.on('AGANI::set-line-ending', (e, { lineEnding, ignoreSaveStatus }) => {
      const { lineEnding: oldLineEnding } = state.currentFile
      if (lineEnding !== oldLineEnding) {
        commit('SET_LINE_ENDING', lineEnding)
        commit('SET_ADJUST_LINE_ENDING_ON_SAVE', lineEnding !== 'lf')
        if (!ignoreSaveStatus) {
          commit('SET_SAVE_STATUS', false)
        }
      }
    })
  }
}

export default { state, getters, mutations, actions }
