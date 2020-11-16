import path from 'path'

module.exports = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          aliases: {
            type: 'object',
          },
          fixible: {
            type: 'boolean',
            default: false,
          },
        },
      },
    ],
  },
  create: function (context) {
    const options = context.options[0] || {}

    const { aliases, fixible: isFixible } = options || {}

    if (!aliases) return

    return {
      ImportDeclaration: function (node) {
        const currentPath = getCurrentPath(context)

        if (!currentPath) return

        const rawSource = node.source.value

        if (!rawSource) return

        const source =
          rawSource === '..' || rawSource === '.' ? rawSource + '/' : rawSource

        const aliasImportKey = getAliasKey({ aliases, importPath: source })

        // If was found alias from import source
        if (aliasImportKey) {
          const [aliasImportPath] = aliases[aliasImportKey]

          // If there is another correct alias
          const someAliasNewPath = getSomeAliasPath({
            aliases,
            source,
            aliasKey: aliasImportKey,
            aliasPath: aliasImportPath,
          })

          if (someAliasNewPath) {
            createReport({
              context,
              node,
              newImportPath: someAliasNewPath,
              isFixible,
            })

            return
          }

          const importPathWithAliasPath = source.replace(
            removeAsterisk(aliasImportKey),
            removeAsterisk(aliasImportPath)
          )

          let newPath = replaceSlashFromPath(
            path.relative(currentPath, importPathWithAliasPath)
          )

          if (
            canUseAliasImport({
              aliases,
              currentPath,
              newPath: importPathWithAliasPath,
              aliasKey: aliasImportKey,
              aliasPath: aliasImportPath,
            })
          ) {
            return
          }

          if (newPath[0] !== '.') {
            newPath = `./${newPath}`
          } else if (newPath[newPath.length - 1] === '.') {
            newPath += '/'
          }

          createReport({ context, node, newImportPath: newPath, isFixible })
        } else {
          const splitedImportPath = source.split('..')

          const countBack = splitedImportPath.length - 1

          if (countBack === 0) return

          const slicedCurrentPath = removeElementsFromEnd(
            currentPath,
            countBack
          )

          const foldersFromImport = splitedImportPath[countBack].split('/')

          const paths = foldersFromImport.flatMap((folders, index) => {
            const createdPath =
              slicedCurrentPath +
              foldersFromImport
                .slice(0, foldersFromImport.length - index)
                .join('/')

            return [createdPath + '/*', createdPath]
          })

          const alias = getAliasByValue({
            aliases,
            importPaths: paths,
          })

          if (!alias) return

          const [aliasKey, [aliasPath]] = alias

          const newPath = slicedCurrentPath + splitedImportPath[countBack]

          if (
            !canUseAliasImport({
              aliases,
              currentPath,
              newPath,
              aliasKey,
              aliasPath,
            })
          ) {
            return
          }

          const newImportPath =
            aliasKey.indexOf('*') !== -1
              ? newPath.replace(
                  removeAsterisk(aliasPath),
                  removeAsterisk(aliasKey)
                )
              : aliasKey

          createReport({
            context,
            node,
            newImportPath,
            isFixible,
          })
        }
      },
    }
  },
}

function replaceSlashFromPath(pathToUpdate) {
  return pathToUpdate.replace(/\\/g, '/')
}

function getCurrentPath(context) {
  const currentDir = replaceSlashFromPath(path.dirname(context.getFilename()))

  const importsIndex = currentDir.indexOf('imports/')

  if (importsIndex === -1) return undefined

  return currentDir.slice(importsIndex)
}

function getSortedAliasesEntries(aliases) {
  return Object.entries(aliases).sort(([, [path1]], [, [path2]]) => {
    const path1Nesting = path1.split('/').length
    const path2Nesting = path2.split('/').length

    return path2Nesting - path1Nesting || path2.length - path1.length
  })
}

function getAliasKey({ aliases, importPath }) {
  const alias = getSortedAliasesEntries(aliases).find(([aliasKey]) =>
    new RegExp(`^${aliasKey.replace('*', '(/|\\w)+')}$`).test(importPath)
  )

  if (!alias) return undefined

  return alias[0]
}

function getAliasByValue({ aliases, importPaths, strict = false }) {
  const aliasesEntries = getSortedAliasesEntries(aliases)

  if (strict) {
    const importPath = importPaths.find((aliasImportPath) =>
      aliasesEntries.some(([, [aliasPath]]) => aliasPath === aliasImportPath)
    )

    if (!importPath) return undefined

    return aliasesEntries.find(([, [aliasPath]]) => aliasPath === importPath)
  }

  return aliasesEntries.find(([, [aliasPath]]) =>
    importPaths.some((importPath) =>
      new RegExp(`^${aliasPath.replace('*', '(/|\\w)+')}$`).test(importPath)
    )
  )
}

function removeElementsFromEnd(pathToUpdate, count = 1) {
  const splitedPath = pathToUpdate.split('/')

  return splitedPath.slice(0, splitedPath.length - count).join('/')
}

function removeAsterisk(pathToUpdate) {
  return pathToUpdate.replace('*', '')
}

function hasSimilarAliasKey({ aliases, aliasKey }) {
  if (aliasKey.indexOf('*') === -1) {
    return !!aliases[aliasKey + '/*']
  }

  return !!aliases[aliasKey.replace('/*', '')]
}

function canUseAliasImport({
  aliases,
  currentPath,
  newPath,
  aliasKey,
  aliasPath,
}) {
  if (currentPath === newPath || currentPath === aliasPath) return false

  const currentPathAlias = getSortedAliasesEntries(
    aliases
  ).find(([, [aliasPathToCompare]]) =>
    new RegExp(`^${aliasPathToCompare.replace('*', '(/|\\w)+')}$`).test(
      currentPath
    )
  )

  if (!currentPathAlias) return true

  const [currentPathAliasKey] = currentPathAlias

  const hasSimilarAlias = hasSimilarAliasKey({ aliases, aliasKey })

  if (aliasPath.indexOf('*') !== -1 && !hasSimilarAlias) {
    const [currentApi] = currentPath
      .replace(removeAsterisk(aliasPath), '')
      .split('/')

    const [newApi] = newPath.replace(removeAsterisk(aliasPath), '').split('/')

    return currentApi && newApi && currentApi !== newApi
  }

  return ![aliasKey, aliasKey + '/*'].includes(currentPathAliasKey)
}

function getSomeAliasPath({ aliases, source, aliasKey, aliasPath }) {
  const newAliasPath = removeAsterisk(
    source.replace(new RegExp(aliasKey), aliasPath)
  )

  const fullAlias = getAliasByValue({
    aliases,
    importPaths: [newAliasPath],
    strict: true,
  })

  if (!fullAlias) return undefined

  const [newPath] = fullAlias

  if (newPath === source) return undefined

  return newPath
}

function createReport({ context, node, newImportPath, isFixible }) {
  context.report({
    node,
    message: `Use '${newImportPath}' instead`,
    fix: function (fixer) {
      if (!isFixible) return null

      return fixer.replaceTextRange(node.source.range, `'${newImportPath}'`)
    },
    suggest: [
      {
        desc: `Replace import path to '${newImportPath}'`,
        fix: function (fixer) {
          return fixer.replaceTextRange(
            node.source.range,
            `'${newImportPath}'`
          )
        },
      },
    ],
  })
}
