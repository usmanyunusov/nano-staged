import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { globToRegex } from './index.js'

function match(lib, glob, strUnix, strWin, opts = {}) {
  if (typeof strWin === 'object') {
    opts = strWin
    strWin = false
  }

  let res = lib(glob, opts)
  return res.regex.test(process.platform === 'win32' && strWin ? strWin : strUnix)
}

test('globToRegex: Standard * matching', () => {
  equal(match(globToRegex, '*', 'foo'), true, 'match everything')
  equal(match(globToRegex, 'f*', 'foo'), true, 'match the end')
  equal(match(globToRegex, '*o', 'foo'), true, 'match the start')
  equal(match(globToRegex, 'f*uck', 'firetruck'), true, 'match the middle')
  equal(match(globToRegex, 'uc', 'firetruck'), false, 'do not match without g')
  equal(match(globToRegex, 'f*uck', 'fuck'), true, 'match zero characters')
})

test('globToRegex: advance * matching', () => {
  equal(match(globToRegex, '*.min.js', 'http://example.com/jquery.min.js'), true, 'complex match')
  equal(match(globToRegex, '*.min.*', 'http://example.com/jquery.min.js'), true, 'complex match')
  equal(
    match(globToRegex, '*/js/*.js', 'http://example.com/js/jquery.min.js'),
    true,
    'complex match'
  )

  const str = '\\/$^+?.()=!|{},[].*'
  equal(match(globToRegex, str, str), true, 'battle test complex string - strict')

  equal(
    match(globToRegex, '.min.', 'http://example.com/jquery.min.js'),
    false,
    'matches without/with using RegExp "g"'
  )
  equal(
    match(globToRegex, '*.min.*', 'http://example.com/jquery.min.js'),
    true,
    'matches without/with using RegExp "g"'
  )
  equal(
    match(globToRegex, 'http:', 'http://example.com/jquery.min.js'),
    false,
    'matches without/with using RegExp "g"'
  )
  equal(
    match(globToRegex, 'http:*', 'http://example.com/jquery.min.js'),
    true,
    'matches without/with using RegExp "g"'
  )
  equal(
    match(globToRegex, 'min.js', 'http://example.com/jquery.min.js'),
    false,
    'matches without/with using RegExp "g"'
  )
  equal(
    match(globToRegex, '*.min.js', 'http://example.com/jquery.min.js'),
    true,
    'matches without/with using RegExp "g"'
  )
  equal(match(globToRegex, '/js*jq*.js', 'http://example.com/js/jquery.min.js'), false)
})

test('globToRegex: ? match one character, no more and no less', () => {
  equal(match(globToRegex, 'f?o', 'foo', { extended: true }), true)
  equal(match(globToRegex, 'f?o', 'fooo', { extended: true }), false)
  equal(match(globToRegex, 'f?oo', 'foo', { extended: true }), false)
})

test('globToRegex: [] match a character range', () => {
  equal(match(globToRegex, 'fo[oz]', 'foo', { extended: true }), true)
  equal(match(globToRegex, 'fo[oz]', 'foz', { extended: true }), true)
  equal(match(globToRegex, 'fo[oz]', 'fog', { extended: true }), false)
  equal(match(globToRegex, 'fo[a-z]', 'fob', { extended: true }), true)
  equal(match(globToRegex, 'fo[a-d]', 'fot', { extended: true }), false)
  equal(match(globToRegex, 'fo[!tz]', 'fot', { extended: true }), false)
  equal(match(globToRegex, 'fo[!tz]', 'fob', { extended: true }), true)
})

test('globToRegex: [] extended character ranges', () => {
  equal(match(globToRegex, '[[:alnum:]]/bar.txt', 'a/bar.txt', { extended: true }), true)
  equal(match(globToRegex, '@([[:alnum:]abc]|11)/bar.txt', '11/bar.txt', { extended: true }), true)
  equal(match(globToRegex, '@([[:alnum:]abc]|11)/bar.txt', 'a/bar.txt', { extended: true }), true)
  equal(match(globToRegex, '@([[:alnum:]abc]|11)/bar.txt', 'b/bar.txt', { extended: true }), true)
  equal(match(globToRegex, '@([[:alnum:]abc]|11)/bar.txt', 'c/bar.txt', { extended: true }), true)
  equal(
    match(globToRegex, '@([[:alnum:]abc]|11)/bar.txt', 'abc/bar.txt', { extended: true }),
    false
  )
  equal(match(globToRegex, '@([[:alnum:]abc]|11)/bar.txt', '3/bar.txt', { extended: true }), true)
  equal(match(globToRegex, '[[:digit:]]/bar.txt', '1/bar.txt', { extended: true }), true)
  equal(match(globToRegex, '[[:digit:]b]/bar.txt', 'b/bar.txt', { extended: true }), true)
  equal(match(globToRegex, '[![:digit:]b]/bar.txt', 'a/bar.txt', { extended: true }), true)
  equal(match(globToRegex, '[[:alnum:]]/bar.txt', '!/bar.txt', { extended: true }), false)
  equal(match(globToRegex, '[[:digit:]]/bar.txt', 'a/bar.txt', { extended: true }), false)
  equal(match(globToRegex, '[[:space:]b]/bar.txt', 'a/bar.txt', { extended: true }), false)
})

test('globToRegex: {} match a choice of different substrings', () => {
  equal(match(globToRegex, 'foo{bar,baaz}', 'foobaaz', { extended: true }), true)
  equal(match(globToRegex, 'foo{bar,baaz}', 'foobar', { extended: true }), true)
  equal(match(globToRegex, 'foo{bar,baaz}', 'foobuzz', { extended: true }), false)
  equal(match(globToRegex, 'foo{bar,b*z}', 'foobuzz', { extended: true }), true)
})

test('globToRegex: complex extended matches', () => {
  equal(
    match(globToRegex, 'http://?o[oz].b*z.com/{*.js,*.html}', 'http://foo.baaz.com/jquery.min.js', {
      extended: true,
    }),
    true
  )
  equal(
    match(globToRegex, 'http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.buzz.com/index.html', {
      extended: true,
    }),
    true
  )
  equal(
    match(globToRegex, 'http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.buzz.com/index.htm', {
      extended: true,
    }),
    false
  )
  equal(
    match(globToRegex, 'http://?o[oz].b*z.com/{*.js,*.html}', 'http://moz.bar.com/index.html', {
      extended: true,
    }),
    false
  )
  equal(
    match(globToRegex, 'http://?o[oz].b*z.com/{*.js,*.html}', 'http://flozz.buzz.com/index.html', {
      extended: true,
    }),
    false
  )
})

test('globToRegex: remaining chars should match themself', () => {
  const testExtStr = '\\/$^+.()=!|,.*'
  equal(match(globToRegex, testExtStr, testExtStr, { extended: true }), true)
})

test('globToRegex: extended extglob ?', () => {
  equal(match(globToRegex, '(foo).txt', '(foo).txt', { extended: true }), true)
  equal(match(globToRegex, '?(foo).txt', 'foo.txt', { extended: true }), true)
  equal(match(globToRegex, '?(foo).txt', '.txt', { extended: true }), true)
  equal(match(globToRegex, '?(foo|bar)baz.txt', 'foobaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba[zr]|qux)baz.txt', 'bazbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba[zr]|qux)baz.txt', 'barbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba[zr]|qux)baz.txt', 'quxbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba[!zr]|qux)baz.txt', 'batbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba*|qux)baz.txt', 'batbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba*|qux)baz.txt', 'batttbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba*|qux)baz.txt', 'quxbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba?(z|r)|qux)baz.txt', 'bazbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(ba?(z|?(r))|qux)baz.txt', 'bazbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '?(foo).txt', 'foo.txt', { extended: false }), false)
  equal(match(globToRegex, '?(foo|bar)baz.txt', 'foobarbaz.txt', { extended: true }), false)
  equal(match(globToRegex, '?(ba[zr]|qux)baz.txt', 'bazquxbaz.txt', { extended: true }), false)
  equal(match(globToRegex, '?(ba[!zr]|qux)baz.txt', 'bazbaz.txt', { extended: true }), false)
})

test('globToRegex: extended extglob *', () => {
  equal(match(globToRegex, '*(foo).txt', 'foo.txt', { extended: true }), true)
  equal(match(globToRegex, '*foo.txt', 'bofoo.txt', { extended: true }), true)
  equal(match(globToRegex, '*(foo).txt', 'foofoo.txt', { extended: true }), true)
  equal(match(globToRegex, '*(foo).txt', '.txt', { extended: true }), true)
  equal(match(globToRegex, '*(fooo).txt', '.txt', { extended: true }), true)
  equal(match(globToRegex, '*(fooo).txt', 'foo.txt', { extended: true }), false)
  equal(match(globToRegex, '*(foo|bar).txt', 'foobar.txt', { extended: true }), true)
  equal(match(globToRegex, '*(foo|bar).txt', 'barbar.txt', { extended: true }), true)
  equal(match(globToRegex, '*(foo|bar).txt', 'barfoobar.txt', { extended: true }), true)
  equal(match(globToRegex, '*(foo|bar).txt', '.txt', { extended: true }), true)
  equal(match(globToRegex, '*(foo|ba[rt]).txt', 'bat.txt', { extended: true }), true)
  equal(match(globToRegex, '*(foo|b*[rt]).txt', 'blat.txt', { extended: true }), true)
  equal(match(globToRegex, '*(foo|b*[rt]).txt', 'tlat.txt', { extended: true }), false)
})

test('globToRegex: extended extglob +', () => {
  equal(match(globToRegex, '+(foo).txt', 'foo.txt', { extended: true }), true)
  equal(match(globToRegex, '+foo.txt', '+foo.txt', { extended: true }), true)
  equal(match(globToRegex, '+(foo).txt', '.txt', { extended: true }), false)
  equal(match(globToRegex, '+(foo|bar).txt', 'foobar.txt', { extended: true }), true)
})

test('globToRegex: extended extglob @', () => {
  equal(match(globToRegex, '@(foo).txt', 'foo.txt', { extended: true }), true)
  equal(match(globToRegex, '@foo.txt', '@foo.txt', { extended: true }), true)
  equal(match(globToRegex, '@(foo|baz)bar.txt', 'foobar.txt', { extended: true }), true)
  equal(match(globToRegex, '@(foo|baz)bar.txt', 'foobazbar.txt', { extended: true }), false)
  equal(match(globToRegex, '@(foo|baz)bar.txt', 'foofoobar.txt', { extended: true }), false)
  equal(match(globToRegex, '@(foo|baz)bar.txt', 'toofoobar.txt', { extended: true }), false)
})

test('globToRegex: extended extglob !', () => {
  equal(match(globToRegex, '!(boo).txt', 'foo.txt', { extended: true }), true)
  equal(match(globToRegex, '!(foo|baz)bar.txt', 'buzbar.txt', { extended: true }), true)
  equal(match(globToRegex, '!bar.txt', '!bar.txt', { extended: true }), true)
  equal(match(globToRegex, '!({foo,bar})baz.txt', 'notbaz.txt', { extended: true }), true)
  equal(match(globToRegex, '!({foo,bar})baz.txt', 'foobaz.txt', { extended: true }), false)
})

test('globrex: stress testing', () => {
  equal(
    match(globToRegex, '**/*/?yfile.{md,js,txt}', 'foo/bar/baz/myfile.md', { extended: true }),
    true
  )
  equal(
    match(globToRegex, '**/*/?yfile.{md,js,txt}', 'foo/baz/myfile.md', { extended: true }),
    true
  )
  equal(
    match(globToRegex, '**/*/?yfile.{md,js,txt}', 'foo/baz/tyfile.js', { extended: true }),
    true
  )
  equal(match(globToRegex, '[[:digit:]_.]/file.js', '1/file.js', { extended: true }), true)
  equal(match(globToRegex, '[[:digit:]_.]/file.js', '2/file.js', { extended: true }), true)
  equal(match(globToRegex, '[[:digit:]_.]/file.js', '_/file.js', { extended: true }), true)
  equal(match(globToRegex, '[[:digit:]_.]/file.js', './file.js', { extended: true }), true)
  equal(match(globToRegex, '[[:digit:]_.]/file.js', 'z/file.js', { extended: true }), false)
})

test.run()
