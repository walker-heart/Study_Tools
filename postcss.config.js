import postcssImport from 'postcss-import'
import tailwindcss from 'tailwindcss'
import tailwindNesting from 'tailwindcss/nesting/index.js'
import postcssNesting from 'postcss-nesting'
import autoprefixer from 'autoprefixer'

export default {
  plugins: [
    postcssImport,
    tailwindNesting(postcssNesting),
    tailwindcss,
    autoprefixer,
  ]
}
