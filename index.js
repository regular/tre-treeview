const pull = require('pull-stream')
const collectMutations = require('collect-mutations')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const h = require('mutant/html-element')
const setStyles = require('module-styles')('tre-treeview')

module.exports = function(ssb, opts) {
  opts = opts || {}

  setStyles(`
    details.no-children>summary::-webkit-details-marker {
      opacity: 0;
    }
  `)

  function renderName(kv) {
    const name = kv.value && kv.value.content && kv.value.content.name || 'no name'
    return h('span', name)
  }

  function revisionRoot(kv) {
    return kv.value.content && kv.value.content.revisionRoot || kv.key
  }

  function branches(kv) {
    return ssb.revisions.messagesByBranch(revisionRoot(kv))
  }

  return function render(kv, ctx) {
    const source = opts.source || branches
    const summary = opts.summary || renderName
    const RenderList = opts.listRenderer || DefaultRenderList
    const children = MutantArray()
    const has_children = computed(children, c => c.length !== 0)
    const drain = collectMutations(children, {sync: opts.sync})
    const children_els = Value()

    function DefaultRenderList() {
      return function(list, ctx) {
        return h('ul', MutantMap(list, m => {
          return h('li', render(m()))
        }, (a,b) => a===b ))
      }
    }

    const el = h('details', {
      classList: computed(has_children, hc => hc ? 'children' : 'no-children'),
      hooks: [el => function release() {
        console.log('release')
        children_els.set(null)
        drain.abort()
      }],
      'ev-toggle': e => {
        if (e.target.open) {
          children_els.set(
            RenderList({
              renderItem: render
            })(children, ctx)
          )
        } else {
          children_els.set(null)
        }
      } 
    }, [
      h('summary', summary(kv)),
      children_els
    ])
    pull(source(kv), drain)
    return el
  }
}
