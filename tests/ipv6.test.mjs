// Run in a disposable container:
// docker run --rm --network none -v "$PWD:/work:ro" -w /work node:24-alpine node tests/ipv6.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isIPv6 } from 'node:net';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html.match(/<input\b[^>]*id="ipaddr"[^>]*>/)[0], /\brequired\b/);
const elements = new Map();
runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document: {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, {});
            return elements.get(id);
        },
    },
});
const pattern = elements.get('ipaddr').pattern;
assert.ok(pattern);
const ipv6 = new RegExp(`^(?:${pattern})$`, 'v');

const valid = [
    'ABCD:EF01:2345:6789:ABCD:EF01:2345:6789',
    '2001:DB8:0:0:8:800:200C:417A', '2001:DB8::8:800:200C:417A',
    'FF01::101', '::1', '::', '0:0:0:0:0:0:13.1.68.3',
    '0:0:0:0:0:FFFF:129.144.52.38', '::13.1.68.3', '::FFFF:129.144.52.38',
    '1:2:3:4:5:6:0.0.0.0', '1:2:3:4:5:6:255.255.255.255',
];
// Exercise every position and length of "::", including embedded IPv4.
for (const mixed of [false, true]) {
    const slots = mixed ? 6 : 8;
    for (let left = 0; left < slots; left++) {
        for (let right = 0; left + right < slots; right++) {
            const before = Array(left).fill('aBcD').join(':');
            const after = [...Array(right).fill('0001'), ...(mixed ? ['192.0.2.1'] : [])].join(':');
            valid.push(`${before}::${after}`);
        }
    }
}
for (const address of valid) {
    assert.ok(isIPv6(address), address);
    assert.ok(ipv6.test(address), address);
}
const invalid = [
    '', 'hello', '192.0.2.1', ':', ':::', '1::2::3', ':1:2:3:4:5:6:7',
    '1:2:3:4:5:6:7:', '1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9',
    '1:2:3:4:5:6:7:8::', '1:2:3:4:5:6::7:8', '12345::', 'gggg::',
    '::ffff:256.1.2.3', '::ffff:192.00.2.1', '::ffff:01.2.3.4',
    '::ffff:1.2.3', '::ffff:1.2.3.4.5', '1:2:3:4:5::6:192.0.2.1',
    '[::1]', '::1/128', 'fe80::1%eth0', ' ::1', '::1 ',
];
for (const address of invalid) assert.ok(!ipv6.test(address), address);
console.log(`Passed ${valid.length} valid and ${invalid.length} invalid IPv6 cases; input is required.`);
