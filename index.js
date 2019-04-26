const pull = require('pull-stream')
const collectMutations = require('collect-mutations')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const watch = require('mutant/watch')
const Value = require('mutant/value')
const h = require('mutant/html-element')
const setStyles = require('module-styles')('tre-treeview')
const ResolvePrototypes = require('tre-prototypes')

module.exports = function(ssb, opts) {
  opts = opts || {}
  let {skipFirstLevel} = opts

  const resolvePrototypes = ResolvePrototypes(ssb)

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
    let resolvedChildren = children
    if (opts.resolve_prototypes !== false) {
      resolvedChildren = MutantMap(children, x => {
        return resolvePrototypes(x, {allowAllAuthors: true})
      }, {comparer})
    }

    function DefaultRenderList() {
      return function(list, ctx) {
        return h('ul', MutantMap(list, m => {
          if (!m) return []
          return h('li', render(m(), ctx))
        }, {comparer}))
      }
    }

    function renderChildren() {
      const newCtx = Object.assign({}, ctx, {
        path: (ctx && ctx.path || []).concat(kv)
      })
      return RenderList({
        renderItem: render
      })(resolvedChildren, newCtx)
    }

    pull(source(kv), drain)

    if (skipFirstLevel) {
      skipFirstLevel = false
      return renderChildren()
    }
    
    let el
    const abortWatch = watch(has_children, hc => {
      if (!el) return
      if (hc && ctx && ctx.shouldOpen && ctx.shouldOpen(kv)) {
        el.open = true   
      } else if (!hc && el.open) {
        el.open = false
      }
    })
    el = h('details', {
      classList: computed(has_children, hc => hc ? 'children' : 'no-children'),
      hooks: [el => function release() {
        children_els.set(null)
        drain.abort()
        abortWatch()
      }],
      'ev-toggle': e => {
        if (e.target.open) {
          if (has_children()) {
            children_els.set(
              renderChildren()
            )
          } else {
            e.target.open = false
          }
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

function comparer(a, b) {
  // NOTE: a and b might be observables 
  /*
  It might be beneficial to overall perofrmance to make a slightly deeper comparison of
  - keys
  - meta (wihtout prototype-chain)
  - keys of prototype chain

  It's not enough to just compare akey to b.key because changes in
  prototypes would slip through.
  */
  return a === b
}

