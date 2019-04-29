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

  function branches(parentKV) {
    //console.log('BRANCHES of', revisionRoot(parentKV))
    return pull(
      ssb.revisions.messagesByBranch(revisionRoot(parentKV), {live: true, sync: true})
      /*
      pull.through(kkv=>{
        if (!kkv.sync) console.log('- branch of', kkv.key)
        else console.log('sync')
      })
      */
    )
  }

  return function render(kv, ctx) {
    if (!kv) return []
    const source = opts.source || branches
    const summary = opts.summary || renderName
    const RenderList = opts.listRenderer || DefaultRenderList
    const children = MutantArray()
    const has_children = computed(children, c =>{
      //console.warn('c.length', c.length)
      return c.length !== 0
    })
    const drain = collectMutations(children, {sync: opts.sync})
    const children_els = Value()
    let resolvedChildren = children
    if (opts.resolve_prototypes !== false) {
      resolvedChildren = MutantMap(children, headObs => {
        return resolvePrototypes(headObs, {
          allowAllAuthors: true,
          suppressIntermediate: false
        })
      }, {comparer: kvcomp})
    }

    function DefaultRenderList() {
      console.warn('DefaultRenderList')
      return function(list, ctx) {
        return h('ul', MutantMap(list, m => {
          if (!m) return []
          return h('li', render(m(), ctx))
        }, {comparer:kvcomp, maxTime: opts.maxTime, idle: true}))
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

    pull(
      source(kv), 
      drain
    )

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

function kvcomp(a,b) {
  a = typeof a == 'function' ? a() : a
  b = typeof b == 'function' ? b() : b
  //console.log(a, '==', b)
  if (!a && !b) return true
  const ak = a && a.key
  const bk = b && b.key
  return ak == bk
}

