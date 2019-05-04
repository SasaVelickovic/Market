import { getUniqueId, cloneObj } from '../util'

/**
 * Default internel markdown document with editor options.
 *
 * @type {IDocumentState} Internel markdown document
 */
export const defaultFileState = {
  // Indicates whether there are unsaved changes.
  isSaved: true,
  // Full path to the file or empty. If the value is empty the file doesn't exist on disk.
  pathname: '',
  filename: 'Untitled-1',
  markdown: '',
  encoding: 'utf8', // Currently just "utf8" or "utf8bom"
  lineEnding: 'lf', // lf or crlf
  adjustLineEndingOnSave: false, // convert editor buffer (LF) to CRLF when saving
  history: {
    stack: [],
    index: -1
  },
  cursor: null,
  wordCount: {
    paragraph: 0,
    word: 0,
    character: 0,
    all: 0
  },
  searchMatches: {
    index: -1,
    matches: [],
    value: ''
  }
}

export const getOptionsFromState = file => {
  const { encoding, lineEnding, adjustLineEndingOnSave } = file
  return { encoding, lineEnding, adjustLineEndingOnSave }
}

export const getFileStateFromData = data => {
  const fileState = JSON.parse(JSON.stringify(defaultFileState))
  const {
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave
  } = data
  const id = getUniqueId()

  assertLineEnding(adjustLineEndingOnSave, lineEnding)

  return Object.assign(fileState, {
    id,
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave
  })
}

export const getBlankFileState = (tabs, lineEnding = 'lf', markdown = '') => {
  const fileState = JSON.parse(JSON.stringify(defaultFileState))
  let untitleId = Math.max(...tabs.map(f => {
    if (f.pathname === '') {
      return +f.filename.split('-')[1]
    } else {
      return 0
    }
  }), 0)

  const id = getUniqueId()

  // We may pass muarkdown=null as parameter.
  if (markdown == null) {
    markdown = ''
  }

  return Object.assign(fileState, {
    lineEnding,
    adjustLineEndingOnSave: lineEnding.toLowerCase() === 'crlf',
    id,
    filename: `Untitled-${++untitleId}`,
    markdown
  })
}

export const getSingleFileState = ({ id = getUniqueId(), markdown, filename, pathname, options }) => {
  // TODO(refactor:renderer/editor): Replace this function with `createDocumentState`.

  const fileState = JSON.parse(JSON.stringify(defaultFileState))
  const { encoding, lineEnding, adjustLineEndingOnSave = 'ltr' } = options

  assertLineEnding(adjustLineEndingOnSave, lineEnding)

  return Object.assign(fileState, {
    id,
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave
  })
}

/**
 * Creates a internal document from the given document.
 *
 * @param {IMarkdownDocument} markdownDocument Markdown document
 * @param {String} [id] Random identifier
 * @returns {IDocumentState} Returns a document state
 */
export const createDocumentState = (markdownDocument, id = getUniqueId()) => {
  const docState = cloneObj(defaultFileState, true)
  const {
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave,
  } = markdownDocument

  assertLineEnding(adjustLineEndingOnSave, lineEnding)

  return Object.assign(docState, {
    id,
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave
  })
}

const assertLineEnding = (adjustLineEndingOnSave, lineEnding) => {
  lineEnding = lineEnding.toLowerCase()
  if ((adjustLineEndingOnSave && lineEnding !== 'crlf') ||
    (!adjustLineEndingOnSave && lineEnding === 'crlf')) {
    console.error('Assertion failed: Line ending is "CRLF" but document is saved as "LF".')
  }
}
