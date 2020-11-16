import { test } from '../utils'

import { RuleTester } from 'eslint'

const ruleTester = new RuleTester()
const rule = require('rules/alias')

const options = [
  {
    aliases: {
      '@itgenio/lib': ['imports/lib'],
      '@itgenio/lib/*': ['imports/lib/*'],
      '@itgenio/api/*': ['imports/api/*'],
      '@itgenio/react-hooks': ['imports/lib/client/reactHooks'],
    },
    fixible: true,
  },
]

ruleTester.run('alias', rule, {
  valid: [
    test({
      code: "import { Calls } from '../../';",
      options,
      filename: 'imports/api/calls/server/api/createCall.ts',
    }),
    test({
      code: "import { Users } from '@itgenio/api/users';",
      options,
      filename: 'imports/api/calls/server/api/createCall.ts',
    }),
  ],
  invalid: [
    test({
      code: "import { Calls } from '@itgenio/api/calls';",
      options,
      filename: 'imports/api/calls/server/api/createCall.ts',
      errors: 1,
      output: "import { Calls } from '../../';",
    }),
    test({
      code: "import { Users } from '../../../users';",
      options,
      filename: 'imports/api/calls/server/api/createCall.ts',
      errors: 1,
      output: "import { Users } from '@itgenio/api/users';",
    }),
    test({
      code: "import { useHook } from '@itgenio/lib/client/reactHooks';",
      options,
      filename: 'imports/api/calls/server/api/createCall.ts',
      errors: 1,
      output: "import { useHook } from '@itgenio/react-hooks';",
    }),
    test({
      code: "import { useHook } from '../reactHooks';",
      filename: 'imports/lib/client/providers/provider.tsx',
      options,
      errors: 1,
      output: "import { useHook } from '@itgenio/react-hooks';",
    }),
    test({
      code: "import { L } from '@itgenio/lib';",
      filename: 'imports/lib/client/someModule.ts',
      options,
      errors: 1,
      output: "import { L } from '../';",
    }),
  ],
})
