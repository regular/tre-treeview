const pull = require('pull-stream')
const collectMutations = require('collect-mutations')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const computed = require('mutant/computed')
const Value = require('mutant/value')
const h = require('mutant/html-element')

module.exports = function(ssb) {
  document.body.appendChild(h('style', `
    details.no-children > summary::-webkit-details-marker {
      opacity: 0;
    }
  `))

  return function render(kv, ctx) {
    const branch = kv.key
    const name = kv.value.content.name
    const children = MutantArray()
    const has_children = computed(children, c => c.length !== 0)
    const drain = collectMutations(children)
    const children_obs = Value()

    const el = h('details', {
      classList: computed(has_children, hc => hc ? 'children' : 'no-children'),
      hooks: [el => function release() {
        console.log('release')
        children_obs.set(null)
        drain.abort()
      }],
      'ev-toggle': e => {
        if (e.target.open) {
          children_obs.set(
            h('ol', MutantMap(children, m => {
              return h('li', render(m()))
            }, (a,b) => a===b ))
          )
        } else {
          children_obs.set(null)
        }
      } 
    }, [
      h('summary', [
        h('span', name),
      ]),
      children_obs
    ])

    pull(
      ssb.revisions.messagesByBranch(branch),
      drain
    )
    return el
  }
}
