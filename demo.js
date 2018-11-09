const {client} = require('tre-client')
const Tree = require('.')
const h = require('mutant/html-element')

client( (err, ssb, config) => {
  if (err) return console.error(err)
  const renderTree = Tree(ssb, {
    summary: kv => h('span', {
      id: 'key_' + kv.key.substr(1)
    }, kv.value.content.name)
  })
  document.body.appendChild(
    renderTree({
      key: config.tre.branches.root,
      value: { content: { name: 'root' } }
    })
  )
}) 
