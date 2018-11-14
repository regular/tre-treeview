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
  let {skipFirstLevel} = opts

  setStyles(`
    details.no-children>summary::-webkit-details-marker {
      opacity: 0.3;
    }
    summary:focus {
      background-color: rgba(0,0,200,0.1);
      outline-color: rgba(0,0,0,0);
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
    return ssb.revisions.messagesByBranch(revisionRoot(kv), {live: true, sync: true})
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
          return h('li', render(m(), ctx))
        }, (a,b) => a===b ))
      }
    }

    function renderChildren() {
      const newCtx = Object.assign({}, ctx, {
        path: (ctx && ctx.path || []).concat(kv)
      })
      return RenderList({
        renderItem: render
      })(children, newCtx)
    }

    pull(source(kv), drain)

    if (skipFirstLevel) {
      skipFirstLevel = false
      return renderChildren()
    }

    const el = h('details', {
      classList: computed(has_children, hc => hc ? 'children' : 'no-children'),
      hooks: [el => function release() {
        children_els.set(null)
        drain.abort()
      }],
      'ev-click': e => {
        if (!has_children()) {
          e.preventDefault()
        }
      },
      'ev-toggle': e => {
        if (e.target.open) {
          children_els.set(
            renderChildren()
          )
        } else {
          children_els.set(null)
        }
      } 
    }, [
      h('summary', summary(kv, ctx)),
      children_els
    ])

    return el
  }
}
