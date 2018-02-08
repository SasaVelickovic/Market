import edit from './edit'
import file from './file'
import help from './help'
import aganippe from './aganippe'
import view from './view'
import windowMenu from './windowMenu'
import paragraph from './paragraph'
import format from './format'

export default function configureMenu ({ app }) {
  let template = process.platform === 'darwin' ? [aganippe({ app })] : []

  return [
    ...template,
    file,
    edit,
    paragraph,
    format,
    windowMenu,
    view,
    help
  ]
}
