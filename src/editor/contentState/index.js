import { setCursorAtLastLine } from '../codeMirror'
import { getUniqueId } from '../utils'
import selection from '../selection'
import StateRender from '../parser/StateRender'
import enterCtrl from './enterCtrl'
import updateCtrl from './updateCtrl'
import garbageCtrl from './garbageCtrl'
import backspaceCtrl from './backspaceCtrl'
import codeBlockCtrl from './codeBlockCtrl'
import tableBlockCtrl from './tableBlockCtrl'
import History from './history'
import historyCtrl from './historyCtrl'
import arrowCtrl from './arrowCtrl'
import pasteCtrl from './pasteCtrl'
import copyCutCtrl from './copyCutCtrl'
import paragraphCtrl from './paragraphCtrl'
import tabCtrl from './tabCtrl'
import formatCtrl from './formatCtrl'
import searchCtrl from './searchCtrl'
import mathCtrl from './mathCtrl'
import imagePathCtrl from './imagePathCtrl'
import htmlBlockCtrl from './htmlBlock'
import importMarkdown from '../utils/importMarkdown'

const prototypes = [
  tabCtrl,
  enterCtrl,
  updateCtrl,
  garbageCtrl,
  backspaceCtrl,
  codeBlockCtrl,
  historyCtrl,
  arrowCtrl,
  pasteCtrl,
  copyCutCtrl,
  tableBlockCtrl,
  paragraphCtrl,
  formatCtrl,
  searchCtrl,
  mathCtrl,
  imagePathCtrl,
  htmlBlockCtrl,
  importMarkdown
]

const HAS_TEXT_BLOCK_REG = /^(h\d|span|th|td|hr|pre)/

// use to cache the keys which you don't want to remove.
const exemption = new Set()

class ContentState {
  constructor (options) {
    const { eventCenter } = options
    Object.assign(this, options)
    this.keys = new Set()
    this.blocks = [ this.createBlockP() ]
    this.stateRender = new StateRender(eventCenter)
    this.codeBlocks = new Map()
    this.loadMathMap = new Map()
    this.history = new History(this)
    this.init()
  }

  init () {
    const lastBlock = this.getLastBlock()
    const { key, text } = lastBlock
    const offset = text.length
    this.searchMatches = {
      value: '', // the search value
      matches: [], // matches
      index: -1 // active match
    }
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    this.history.push({
      type: 'normal',
      blocks: this.blocks,
      cursor: this.cursor
    })
  }

  setCursor () {
    const { start: { key } } = this.cursor
    const block = this.getBlock(key)
    if (block.type !== 'pre') {
      selection.setCursorRange(this.cursor)
    } else {
      const cm = this.codeBlocks.get(key)
      const { pos } = block
      if (pos) {
        cm.focus()
        cm.setCursor(pos)
      } else {
        setCursorAtLastLine(cm)
      }
    }
  }

  render (isRenderCursor = true) {
    const { blocks, cursor, searchMatches: { matches, index } } = this
    const activeBlocks = this.getActiveBlocks()
    matches.forEach((m, i) => {
      m.active = i === index
    })
    const emptyPres = this.stateRender.render(blocks, cursor, activeBlocks, matches)
    this.pre2CodeMirror(isRenderCursor, emptyPres)
    if (isRenderCursor) this.setCursor()
    this.renderMath()
  }

  partialRender (block) {
    const { cursor } = this
    this.stateRender.partialRender(block, cursor)
    this.setCursor()
    this.renderMath(block)
  }

  /**
   * A block in Aganippe present a paragraph(block syntax in GFM) or a line in paragraph.
   * a line block must in a `p block` and `p block`'s children must be line blocks.
   */
  createBlock (type = 'span', text = '') { // span type means it is a line block.
    const key = getUniqueId(this.keys)
    return {
      key,
      type,
      text,
      parent: null,
      preSibling: null,
      nextSibling: null,
      children: []
    }
  }

  createBlockP (text = '') {
    const pBlock = this.createBlock('p')
    const lineBlock = this.createBlock('span', text)
    this.appendChild(pBlock, lineBlock)
    return pBlock
  }

  isCollapse (cursor = this.cursor) {
    const { start, end } = cursor
    return start.key === end.key && start.offset === end.offset
  }

  // getBlocks
  getBlocks () {
    // for (const [ key, cm ] of this.codeBlocks.entries()) {
    //   const value = cm.getValue()
    //   const block = this.getBlock(key)
    //   if (block) block.text = value
    // }
    return this.blocks
  }

  getCursor () {
    return this.cursor
  }

  getBlock (key) {
    let result = null
    const travel = blocks => {
      for (const block of blocks) {
        if (block.key === key) {
          result = block
          return
        }
        const { children } = block
        if (children.length) {
          travel(children)
        }
      }
    }
    travel(this.blocks)
    return result
  }

  getParent (block) {
    if (block && block.parent) {
      return this.getBlock(block.parent)
    }
    return null
  }
  // return block and its parents
  getParents (block) {
    const result = []
    result.push(block)
    let parent = this.getParent(block)
    while (parent) {
      result.push(parent)
      parent = this.getParent(parent)
    }
    return result
  }

  getPreSibling (block) {
    return block.preSibling ? this.getBlock(block.preSibling) : null
  }

  getNextSibling (block) {
    return block.nextSibling ? this.getBlock(block.nextSibling) : null
  }

  /**
   * if target is descendant of parent return true, else return false
   * @param  {[type]}  parent [description]
   * @param  {[type]}  target [description]
   * @return {Boolean}        [description]
   */
  isInclude (parent, target) {
    const children = parent.children
    if (children.length === 0) {
      return false
    } else {
      if (children.some(child => child.key === target.key)) {
        return true
      } else {
        return children.some(child => this.isInclude(child, target))
      }
    }
  }

  removeTextOrBlock (block) {
    const checkerIn = block => {
      if (exemption.has(block.key)) {
        return true
      } else {
        const parent = this.getBlock(block.parent)
        return parent ? checkerIn(parent) : false
      }
    }

    const checkerOut = block => {
      const children = block.children
      if (children.length) {
        if (children.some(child => exemption.has(child.key))) {
          return true
        } else {
          return children.some(child => checkerOut(child))
        }
      } else {
        return false
      }
    }

    if (checkerIn(block) || checkerOut(block)) {
      block.text = ''
      const { children } = block
      if (children.length) {
        children.forEach(child => this.removeTextOrBlock(child))
      }
    } else {
      this.removeBlock(block)
    }
  }
  // help func in removeBlocks
  findFigure (block) {
    if (block.type === 'figure') {
      return block.key
    } else {
      const parent = this.getBlock(block.parent)
      return this.findFigure(parent)
    }
  }

  /**
   * remove blocks between before and after, and includes after block.
   */
  removeBlocks (before, after, isRemoveAfter = true, isRecursion = false) {
    if (!isRecursion) {
      if (/td|th/.test(before.type)) {
        exemption.add(this.findFigure(before))
      }
      if (/td|th/.test(after.type)) {
        exemption.add(this.findFigure(after))
      }
    }
    let nextSibling = this.getBlock(before.nextSibling)
    let beforeEnd = false
    while (nextSibling) {
      if (nextSibling.key === after.key || this.isInclude(nextSibling, after)) {
        beforeEnd = true
        break
      }
      this.removeTextOrBlock(nextSibling)
      nextSibling = this.getBlock(nextSibling.nextSibling)
    }
    if (!beforeEnd) {
      const parent = this.getParent(before)
      if (parent) {
        this.removeBlocks(parent, after, false, true)
      }
    }
    let preSibling = this.getBlock(after.preSibling)
    let afterEnd = false
    while (preSibling) {
      if (preSibling.key === before.key || this.isInclude(preSibling, before)) {
        afterEnd = true
        break
      }
      this.removeTextOrBlock(preSibling)
      preSibling = this.getBlock(preSibling.preSibling)
    }
    if (!afterEnd) {
      const parent = this.getParent(after)
      if (parent) {
        const isOnlyChild = this.isOnlyChild(after)
        this.removeBlocks(before, parent, isOnlyChild, true)
      }
    }
    if (isRemoveAfter) {
      this.removeTextOrBlock(after)
    }
    if (!isRecursion) {
      exemption.clear()
    }
  }

  removeBlock (block, fromBlocks = this.blocks) {
    if (block.type === 'pre') {
      const codeBlockId = block.key
      if (this.codeBlocks.has(codeBlockId)) {
        this.codeBlocks.delete(codeBlockId)
      }
    }
    const remove = (blocks, block) => {
      const len = blocks.length
      let i
      for (i = 0; i < len; i++) {
        if (blocks[i].key === block.key) {
          const preSibling = this.getBlock(block.preSibling)
          const nextSibling = this.getBlock(block.nextSibling)

          if (preSibling) {
            preSibling.nextSibling = nextSibling ? nextSibling.key : null
          }
          if (nextSibling) {
            nextSibling.preSibling = preSibling ? preSibling.key : null
          }

          return blocks.splice(i, 1)
        } else {
          if (blocks[i].children.length) {
            remove(blocks[i].children, block)
          }
        }
      }
    }
    remove(Array.isArray(fromBlocks) ? fromBlocks : fromBlocks.children, block)
  }

  getActiveBlocks () {
    let result = []
    let block = this.getBlock(this.cursor.start.key)
    if (block) result.push(block)
    while (block && block.parent) {
      block = this.getBlock(block.parent)
      result.push(block)
    }
    return result
  }

  getCursorBlock () {
    return this.getBlock(this.cursor.key) || null
  }

  insertAfter (newBlock, oldBlock) {
    const siblings = oldBlock.parent ? this.getBlock(oldBlock.parent).children : this.blocks
    const oldNextSibling = this.getBlock(oldBlock.nextSibling)
    const index = this.findIndex(siblings, oldBlock)
    siblings.splice(index + 1, 0, newBlock)
    oldBlock.nextSibling = newBlock.key
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = oldBlock.key
    if (oldNextSibling) {
      newBlock.nextSibling = oldNextSibling.key
      oldNextSibling.preSibling = newBlock.key
    }
  }

  insertBefore (newBlock, oldBlock) {
    const siblings = oldBlock.parent ? this.getBlock(oldBlock.parent).children : this.blocks
    const oldPreSibling = this.getBlock(oldBlock.preSibling)
    const index = this.findIndex(siblings, oldBlock)
    siblings.splice(index, 0, newBlock)
    oldBlock.preSibling = newBlock.key
    newBlock.parent = oldBlock.parent
    newBlock.nextSibling = oldBlock.key

    if (oldPreSibling) {
      oldPreSibling.nextSibling = newBlock.key
      newBlock.preSibling = oldPreSibling.key
    }
  }

  findOutMostBlock (block) {
    if (!block.parent) return block
    else {
      const parent = this.getBlock(block.parent)
      return this.findOutMostBlock(parent)
    }
  }

  findIndex (children, block) {
    const len = children.length
    let i
    for (i = 0; i < len; i++) {
      if (children[i].key === block.key) return i
    }
    return -1
  }

  prependChild (parent, block) {
    if (parent.children.length) {
      const firstChild = parent.children[0]
      this.insertBefore(block, firstChild)
    } else {
      this.appendChild(parent, block)
    }
  }

  appendChild (parent, block) {
    const len = parent.children.length
    const lastChild = parent.children[len - 1]
    parent.children.push(block)
    block.parent = parent.key
    if (lastChild) {
      lastChild.nextSibling = block.key
      block.preSibling = lastChild.key
    } else {
      block.preSibling = null
    }
    block.nextSibling = null
  }

  replaceBlock (newBlock, oldBlock) {
    let index
    if (!oldBlock.parent) {
      index = this.findIndex(this.blocks, oldBlock)
      this.blocks.splice(index, 1, newBlock)
    } else {
      const parent = this.getBlock(oldBlock.parent)
      index = this.findIndex(parent.children, oldBlock)
      parent.children.splice(index, 1, newBlock)
    }
    newBlock.parent = oldBlock.parent
    newBlock.preSibling = oldBlock.preSibling
    newBlock.nextSibling = oldBlock.nextSibling
  }

  isFirstChild (block) {
    return !block.preSibling
  }

  isLastChild (block) {
    return !block.nextSibling
  }

  isOnlyChild (block) {
    return !block.nextSibling && !block.preSibling
  }

  getLastChild (block) {
    const len = block.children.length
    if (len) {
      return block.children[len - 1]
    }
    return null
  }

  firstInDescendant (block) {
    const children = block.children
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (children.length) {
      if (children[0].type === 'input' || (children[0].type === 'div' && children[0].editable === false)) { // handle task item
        return this.firstInDescendant(children[1])
      } else {
        return this.firstInDescendant(children[0])
      }
    }
  }

  lastInDescendant (block) {
    if (block.children.length === 0 && HAS_TEXT_BLOCK_REG.test(block.type)) {
      return block
    } else if (block.children.length) {
      const children = block.children
      let lastChild = children[children.length - 1]
      while (lastChild.editable === false) {
        lastChild = this.getPreSibling(lastChild)
      }
      return this.lastInDescendant(lastChild)
    }
  }

  findPreBlockInLocation (block) {
    const parent = this.getParent(block)
    const preBlock = this.getPreSibling(block)
    if (block.preSibling && preBlock.type !== 'input' && preBlock.type !== 'div' && preBlock.editable !== false) { // handle task item and table
      return this.lastInDescendant(preBlock)
    } else if (parent) {
      return this.findPreBlockInLocation(parent)
    } else {
      return null
    }
  }

  findNextBlockInLocation (block) {
    const parent = this.getParent(block)
    const nextBlock = this.getNextSibling(block)

    if (block.nextSibling && nextBlock.editable !== false) {
      return this.firstInDescendant(nextBlock)
    } else if (parent) {
      return this.findNextBlockInLocation(parent)
    } else {
      return null
    }
  }

  getLastBlock () {
    const { blocks } = this
    const len = blocks.length
    return this.lastInDescendant(blocks[len - 1])
  }

  wordCount (markdown) {
    let paragraph = this.blocks.length
    let word = 0
    let character = 0
    let all = 0

    const removedChinese = markdown.replace(/[\u4e00-\u9fa5]/g, '')
    const tokens = removedChinese.split(/[\s\n]+/).filter(t => t)
    const chineseWordLength = markdown.length - removedChinese.length
    word += chineseWordLength + tokens.length
    character += tokens.reduce((acc, t) => acc + t.length, 0) + chineseWordLength
    all += markdown.length

    return { word, paragraph, character, all }
  }

  clear () {
    this.keys.clear()
    this.codeBlocks.clear()
  }
}

prototypes.forEach(ctrl => ctrl(ContentState))

export default ContentState
