const pull = require('pull-stream')
const collectMutations = require('collect-mutations')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const h = require('mutant/html-element')

module.exports = function(ssb, opts) {
  opts = opts || {}

  document.body.appendChild(h('style', `
    .no-children>details>summary::-webkit-details-marker {
      opacity: 0;
    }
  `))

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
    const children = MutantArray()
    const has_children = computed(children, c => c.length !== 0)
    const drain = collectMutations(children)
    const children_obs = Value()

    const el = h(
      'li', {
        classList: computed(has_children, hc => hc ? 'children' : 'no-children'),
        hooks: [el => function release() {
          console.log('release')
          children_obs.set(null)
          drain.abort()
        }]
      },
      h('details', {
        'ev-toggle': e => {
          if (e.target.open) {
            children_obs.set(
              h('ul', MutantMap(children, m => {
                return render(m())
              }, (a,b) => a===b ))
            )
          } else {
            children_obs.set(null)
          }
        } 
      }, [
        h('summary', summary(kv)),
        children_obs
      ])
    )
    pull(source(kv), drain)
    return el
  }
}
