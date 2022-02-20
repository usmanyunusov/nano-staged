import { is } from 'uvu/assert'
import { test } from 'uvu'

import { globToRegex } from '../lib/glob-to-regex.js'

function match(glob, path, opts = {}) {
  return globToRegex(glob, opts).regex.test(path)
}

test('Standard * matching', () => {
  is(match('*', 'foo'), true)
  is(match('f*', 'foo'), true)
  is(match('*o', 'foo'), true)
  is(match('f*uck', 'firetruck'), true)
  is(match('uc', 'firetruck'), false)
  is(match('f*uck', 'fuck'), true)
})

test('advance * matching', () => {
  is(match('*.min.js', 'http://example.com/jquery.min.js', { globstar: false }), true)
  is(match('*.min.*', 'http://example.com/jquery.min.js', { globstar: false }), true)
  is(match('*/js/*.js', 'http://example.com/js/jquery.min.js', { globstar: false }), true)
  is(match('*.min.js', 'http://example.com/jquery.min.js'), true)
  is(match('*.min.*', 'http://example.com/jquery.min.js'), true)
  is(match('*/js/*.js', 'http://example.com/js/jquery.min.js'), true)

  const str = '\\/$^+?.()=!|{},[].*'
  is(match(str, str), true)

  is(match('.min.', 'http://example.com/jquery.min.js'), false)
  is(match('*.min.*', 'http://example.com/jquery.min.js'), true)
  is(match('http:', 'http://example.com/jquery.min.js'), false)
  is(match('http:*', 'http://example.com/jquery.min.js'), true)
  is(match('min.js', 'http://example.com/jquery.min.js'), false)
  is(match('*.min.js', 'http://example.com/jquery.min.js'), true)
  is(match('/js*jq*.js', 'http://example.com/js/jquery.min.js'), false)
})

test('? match one character, no more and no less', () => {
  is(match('f?o', 'foo', { extended: true }), true)
  is(match('f?o', 'fooo', { extended: true }), false)
  is(match('f?oo', 'foo', { extended: true }), false)

  const tester = (globstar) => {
    is(match('f?o', 'foo', { extended: true, globstar, flags: 'g' }), true)
    is(match('f?o', 'fooo', { extended: true, globstar, flags: 'g' }), true)
    is(match('f?o?', 'fooo', { extended: true, globstar, flags: 'g' }), true)

    is(match('?fo', 'fooo', { extended: true, globstar, flags: 'g' }), false)
    is(match('f?oo', 'foo', { extended: true, globstar, flags: 'g' }), false)
    is(match('foo?', 'foo', { extended: true, globstar, flags: 'g' }), false)
  }

  tester(true)
  tester(false)
})

test('[] match a character range', () => {
  is(match('fo[oz]', 'foo', { extended: true }), true)
  is(match('fo[oz]', 'foz', { extended: true }), true)
  is(match('fo[oz]', 'fog', { extended: true }), false)
  is(match('fo[a-z]', 'fob', { extended: true }), true)
  is(match('fo[a-d]', 'fot', { extended: true }), false)
  is(match('fo[!tz]', 'fot', { extended: true }), false)
  is(match('fo[!tz]', 'fob', { extended: true }), true)

  const tester = (globstar) => {
    is(match('fo[oz]', 'foo', { extended: true, globstar, flags: 'g' }), true)
    is(match('fo[oz]', 'foz', { extended: true, globstar, flags: 'g' }), true)
    is(match('fo[oz]', 'fog', { extended: true, globstar, flags: 'g' }), false)
  }

  tester(true)
  tester(false)
})

test('[] extended character ranges', () => {
  is(match('[[:alnum:]]/bar.txt', 'a/bar.txt', { extended: true }), true)
  is(match('@([[:alnum:]abc]|11)/bar.txt', '11/bar.txt', { extended: true }), true)
  is(match('@([[:alnum:]abc]|11)/bar.txt', 'a/bar.txt', { extended: true }), true)
  is(match('@([[:alnum:]abc]|11)/bar.txt', 'b/bar.txt', { extended: true }), true)
  is(match('@([[:alnum:]abc]|11)/bar.txt', 'c/bar.txt', { extended: true }), true)
  is(match('@([[:alnum:]abc]|11)/bar.txt', 'abc/bar.txt', { extended: true }), false)
  is(match('@([[:alnum:]abc]|11)/bar.txt', '3/bar.txt', { extended: true }), true)
  is(match('[[:digit:]]/bar.txt', '1/bar.txt', { extended: true }), true)
  is(match('[[:digit:]b]/bar.txt', 'b/bar.txt', { extended: true }), true)
  is(match('[![:digit:]b]/bar.txt', 'a/bar.txt', { extended: true }), true)
  is(match('[[:alnum:]]/bar.txt', '!/bar.txt', { extended: true }), false)
  is(match('[[:digit:]]/bar.txt', 'a/bar.txt', { extended: true }), false)
  is(match('[[:space:]b]/bar.txt', 'a/bar.txt', { extended: true }), false)
})

test('{} match a choice of different substrings', () => {
  is(match('foo{bar,baaz}', 'foobaaz', { extended: true }), true)
  is(match('foo{bar,baaz}', 'foobar', { extended: true }), true)
  is(match('foo{bar,baaz}', 'foobuzz', { extended: true }), false)
  is(match('foo{bar,b*z}', 'foobuzz', { extended: true }), true)

  const tester = (globstar) => {
    is(match('foo{bar,baaz}', 'foobaaz', { extended: true, globstar, flag: 'g' }), true)
    is(match('foo{bar,baaz}', 'foobar', { extended: true, globstar, flag: 'g' }), true)
    is(match('foo{bar,baaz}', 'foobuzz', { extended: true, globstar, flag: 'g' }), false)
    is(match('foo{bar,b*z}', 'foobuzz', { extended: true, globstar, flag: 'g' }), true)
  }

  tester(true)
  tester(false)
})

test('complex extended matches', () => {
  is(
    match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://foo.baaz.com/jquery.min.js', {
      extended: true,
    }),
    true
  )
  is(
    match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.buzz.com/index.html', {
      extended: true,
    }),
    true
  )
  is(
    match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.buzz.com/index.htm', {
      extended: true,
    }),
    false
  )
  is(
    match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.bar.com/index.html', {
      extended: true,
    }),
    false
  )
  is(
    match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://flozz.buzz.com/index.html', {
      extended: true,
    }),
    false
  )

  const tester = (globstar) => {
    is(
      match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://foo.baaz.com/jquery.min.js', {
        extended: true,
        globstar,
        flags: 'g',
      }),
      true
    )
    is(
      match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.buzz.com/index.html', {
        extended: true,
        globstar,
        flags: 'g',
      }),
      true
    )
    is(
      match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.buzz.com/index.htm', {
        extended: true,
        globstar,
        flags: 'g',
      }),
      false
    )
    is(
      match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.bar.com/index.html', {
        extended: true,
        globstar,
        flags: 'g',
      }),
      false
    )
    is(
      match('http://?o[oz].b*z.com/{*.js,*.html}', 'http://flozz.buzz.com/index.html', {
        extended: true,
        globstar,
        flags: 'g',
      }),
      false
    )
  }

  tester(true)
  tester(false)
})

test('standard globstar', () => {
  const tester = (globstar) => {
    is(
      match('http://foo.com/**/{*.js,*.html}', 'http://foo.com/bar/jquery.min.js', {
        extended: true,
        globstar,
        flags: 'g',
      }),
      true
    )
    is(
      match('http://foo.com/**/{*.js,*.html}', 'http://foo.com/bar/baz/jquery.min.js', {
        extended: true,
        globstar,
        flags: 'g',
      }),
      true
    )
    is(
      match('http://foo.com/**', 'http://foo.com/bar/baz/jquery.min.js', {
        extended: true,
        globstar,
        flags: 'g',
      }),
      true
    )
  }

  tester(true)
  tester(false)
})

// test('remaining chars should match themself', () => {
//   const tester = (globstar) => {
//     const testExtStr = '\\/$^+.()=!|,.*'
//     is(match(testExtStr, testExtStr, { extended: true }), true)
//     is(match(testExtStr, testExtStr, { extended: true, globstar, flags: 'g' }), true)
//   }

//   tester(true)
//   tester(false)
// })

test('globstar advance testing', (t) => {
  is(match('/foo/*', '/foo/bar.txt', { globstar: true }), true)
  is(match('/foo/**', '/foo/bar.txt', { globstar: true }), true)
  is(match('/foo/**', '/foo/bar/baz.txt', { globstar: true }), true)
  is(match('/foo/**', '/foo/bar/baz.txt', { globstar: true }), true)
  is(match('/foo/*/*.txt', '/foo/bar/baz.txt', { globstar: true }), true)
  is(match('/foo/**/*.txt', '/foo/bar/baz.txt', { globstar: true }), true)
  is(match('/foo/**/*.txt', '/foo/bar/baz/qux.txt', { globstar: true }), true)
  is(match('/foo/**/bar.txt', '/foo/bar.txt', { globstar: true }), true)
  is(match('/foo/**/**/bar.txt', '/foo/bar.txt', { globstar: true }), true)
  is(match('/foo/**/*/baz.txt', '/foo/bar/baz.txt', { globstar: true }), true)
  is(match('/foo/**/*.txt', '/foo/bar.txt', { globstar: true }), true)
  is(match('/foo/**/**/*.txt', '/foo/bar.txt', { globstar: true }), true)
  is(match('/foo/**/*/*.txt', '/foo/bar/baz.txt', { globstar: true }), true)
  is(match('**/*.txt', '/foo/bar/baz/qux.txt', { globstar: true }), true)
  is(match('**/foo.txt', 'foo.txt', { globstar: true }), true)
  is(match('**/*.txt', 'foo.txt', { globstar: true }), true)
  is(match('/foo/*', '/foo/bar/baz.txt', { globstar: true }), false)
  is(match('/foo/*.txt', '/foo/bar/baz.txt', { globstar: true }), false)
  is(match('/foo/*/*.txt', '/foo/bar/baz/qux.txt', { globstar: true }), false)
  is(match('/foo/*/bar.txt', '/foo/bar.txt', { globstar: true }), false)
  is(match('/foo/*/*/baz.txt', '/foo/bar/baz.txt', { globstar: true }), false)
  is(match('/foo/**.txt', '/foo/bar/baz/qux.txt', { globstar: true }), false)
  is(match('/foo/bar**/*.txt', '/foo/bar/baz/qux.txt', { globstar: true }), false)
  is(match('/foo/bar**', '/foo/bar/baz.txt', { globstar: true }), false)
  is(match('**/.txt', '/foo/bar/baz/qux.txt', { globstar: true }), false)
  is(match('*/*.txt', '/foo/bar/baz/qux.txt', { globstar: true }), false)
  is(match('*/*.txt', 'foo.txt', { globstar: true }), false)
  is(
    match('http://foo.com/*', 'http://foo.com/bar/baz/jquery.min.js', {
      extended: true,
      globstar: true,
    }),
    false
  )
  is(match('http://foo.com/*', 'http://foo.com/bar/baz/jquery.min.js', { globstar: true }), false)
  is(match('http://foo.com/*', 'http://foo.com/bar/baz/jquery.min.js', { globstar: false }), true)
  is(match('http://foo.com/**', 'http://foo.com/bar/baz/jquery.min.js', { globstar: true }), true)
  is(
    match('http://foo.com/*/*/jquery.min.js', 'http://foo.com/bar/baz/jquery.min.js', {
      globstar: true,
    }),
    true
  )
  is(
    match('http://foo.com/**/jquery.min.js', 'http://foo.com/bar/baz/jquery.min.js', {
      globstar: true,
    }),
    true
  )
  is(
    match('http://foo.com/*/*/jquery.min.js', 'http://foo.com/bar/baz/jquery.min.js', {
      globstar: false,
    }),
    true
  )
  is(
    match('http://foo.com/*/jquery.min.js', 'http://foo.com/bar/baz/jquery.min.js', {
      globstar: false,
    }),
    true
  )
  is(
    match('http://foo.com/*/jquery.min.js', 'http://foo.com/bar/baz/jquery.min.js', {
      globstar: true,
    }),
    false
  )
})

test('extended extglob ?', () => {
  is(match('(foo).txt', '(foo).txt', { extended: true }), true)
  is(match('?(foo).txt', 'foo.txt', { extended: true }), true)
  is(match('?(foo).txt', '.txt', { extended: true }), true)
  is(match('?(foo|bar)baz.txt', 'foobaz.txt', { extended: true }), true)
  is(match('?(ba[zr]|qux)baz.txt', 'bazbaz.txt', { extended: true }), true)
  is(match('?(ba[zr]|qux)baz.txt', 'barbaz.txt', { extended: true }), true)
  is(match('?(ba[zr]|qux)baz.txt', 'quxbaz.txt', { extended: true }), true)
  is(match('?(ba[!zr]|qux)baz.txt', 'batbaz.txt', { extended: true }), true)
  is(match('?(ba*|qux)baz.txt', 'batbaz.txt', { extended: true }), true)
  is(match('?(ba*|qux)baz.txt', 'batttbaz.txt', { extended: true }), true)
  is(match('?(ba*|qux)baz.txt', 'quxbaz.txt', { extended: true }), true)
  is(match('?(ba?(z|r)|qux)baz.txt', 'bazbaz.txt', { extended: true }), true)
  is(match('?(ba?(z|?(r))|qux)baz.txt', 'bazbaz.txt', { extended: true }), true)
  is(match('?(foo).txt', 'foo.txt', { extended: false }), false)
  is(match('?(foo|bar)baz.txt', 'foobarbaz.txt', { extended: true }), false)
  is(match('?(ba[zr]|qux)baz.txt', 'bazquxbaz.txt', { extended: true }), false)
  is(match('?(ba[!zr]|qux)baz.txt', 'bazbaz.txt', { extended: true }), false)
})

test('extended extglob *', () => {
  is(match('*(foo).txt', 'foo.txt', { extended: true }), true)
  is(match('*foo.txt', 'bofoo.txt', { extended: true }), true)
  is(match('*(foo).txt', 'foofoo.txt', { extended: true }), true)
  is(match('*(foo).txt', '.txt', { extended: true }), true)
  is(match('*(fooo).txt', '.txt', { extended: true }), true)
  is(match('*(fooo).txt', 'foo.txt', { extended: true }), false)
  is(match('*(foo|bar).txt', 'foobar.txt', { extended: true }), true)
  is(match('*(foo|bar).txt', 'barbar.txt', { extended: true }), true)
  is(match('*(foo|bar).txt', 'barfoobar.txt', { extended: true }), true)
  is(match('*(foo|bar).txt', '.txt', { extended: true }), true)
  is(match('*(foo|ba[rt]).txt', 'bat.txt', { extended: true }), true)
  is(match('*(foo|b*[rt]).txt', 'blat.txt', { extended: true }), true)
  is(match('*(foo|b*[rt]).txt', 'tlat.txt', { extended: true }), false)
  is(match('*(*).txt', 'whatever.txt', { extended: true, globstar: true }), true)
  is(
    match('*(foo|bar)/**/*.txt', 'foo/hello/world/bar.txt', { extended: true, globstar: true }),
    true
  )
  is(match('*(foo|bar)/**/*.txt', 'foo/world/bar.txt', { extended: true, globstar: true }), true)
})

test('extended extglob +', () => {
  is(match('+(foo).txt', 'foo.txt', { extended: true }), true)
  is(match('+foo.txt', '+foo.txt', { extended: true }), true)
  is(match('+(foo).txt', '.txt', { extended: true }), false)
  is(match('+(foo|bar).txt', 'foobar.txt', { extended: true }), true)
})

test('extended extglob @', () => {
  is(match('@(foo).txt', 'foo.txt', { extended: true }), true)
  is(match('@foo.txt', '@foo.txt', { extended: true }), true)
  is(match('@(foo|baz)bar.txt', 'foobar.txt', { extended: true }), true)
  is(match('@(foo|baz)bar.txt', 'foobazbar.txt', { extended: true }), false)
  is(match('@(foo|baz)bar.txt', 'foofoobar.txt', { extended: true }), false)
  is(match('@(foo|baz)bar.txt', 'toofoobar.txt', { extended: true }), false)
})

test('extended extglob !', () => {
  is(match('!(boo).txt', 'foo.txt', { extended: true }), true)
  is(match('!(foo|baz)bar.txt', 'buzbar.txt', { extended: true }), true)
  is(match('!bar.txt', '!bar.txt', { extended: true }), true)
  is(match('!({foo,bar})baz.txt', 'notbaz.txt', { extended: true }), true)
  is(match('!({foo,bar})baz.txt', 'foobaz.txt', { extended: true }), false)
})

test('stress testing', () => {
  is(match('**/*/?yfile.{md,js,txt}', 'foo/bar/baz/myfile.md', { extended: true }), true)
  is(match('**/*/?yfile.{md,js,txt}', 'foo/baz/myfile.md', { extended: true }), true)
  is(match('**/*/?yfile.{md,js,txt}', 'foo/baz/tyfile.js', { extended: true }), true)
  is(match('[[:digit:]_.]/file.js', '1/file.js', { extended: true }), true)
  is(match('[[:digit:]_.]/file.js', '2/file.js', { extended: true }), true)
  is(match('[[:digit:]_.]/file.js', '_/file.js', { extended: true }), true)
  is(match('[[:digit:]_.]/file.js', './file.js', { extended: true }), true)
  is(match('[[:digit:]_.]/file.js', 'z/file.js', { extended: true }), false)
})

test('stress testing 2', () => {
  is(match('**/*/?yfile.(md|js|txt)', 'foo/bar/baz/myfile.md', { extended: true }), true)
  is(match('**/*/?yfile.(md|js|txt)', 'foo/baz/myfile.md', { extended: true }), true)
  is(match('**/*/?yfile.(md|js|txt)', 'foo/baz/tyfile.js', { extended: true }), true)
})

test.run()
