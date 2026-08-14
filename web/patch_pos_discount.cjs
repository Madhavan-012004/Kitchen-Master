const fs = require('fs');

const file = 'src/pages/PoultryPOS.jsx';
if (!fs.existsSync(file)) process.exit(1);

let c = fs.readFileSync(file, 'utf8');

// 1. Add discountType State
c = c.replace(
    `const [discount, setDiscount] = useState(0);`,
    `const [discount, setDiscount] = useState(0);\n    const [discountType, setDiscountType] = useState('percentage');`
);

// 2. Parsed.push
c = c.replace(
    `parsed.push({ ...c, address: meta.address, defaultDiscount: meta.defaultDiscount, pendingAmount: meta.pendingAmount });`,
    `parsed.push({ ...c, address: meta.address, defaultDiscount: meta.defaultDiscount, defaultDiscountType: meta.defaultDiscountType || 'percentage', pendingAmount: meta.pendingAmount });`
);

// 3. Walkin overrides
c = c.replace(
    /const walkin = \{ _id: 'walkin', id: 'walkin', name: 'Walk-in Customer', defaultDiscount: 0 \};/g,
    `const walkin = { _id: 'walkin', id: 'walkin', name: 'Walk-in Customer', defaultDiscount: 0, defaultDiscountType: 'percentage' };`
);
c = c.replace(
    /setClients\(\[\{ _id: 'walkin', id: 'walkin', name: 'Walk-in Customer', defaultDiscount: 0 \}, \.\.\.formattedLocal\]\);/g,
    `setClients([{ _id: 'walkin', id: 'walkin', name: 'Walk-in Customer', defaultDiscount: 0, defaultDiscountType: 'percentage' }, ...formattedLocal]);`
);

// 4. handleClientChange
const oldHandleClientChange = `        if (client && client.defaultDiscount > 0) {
            setDiscount(client.defaultDiscount);
            setDiscountLocked(!canOverrideDiscount);
        } else {
            setDiscount(0);
            setDiscountLocked(false);
        }`;

const newHandleClientChange = `        if (client && client.defaultDiscount > 0) {
            setDiscount(client.defaultDiscount);
            setDiscountType(client.defaultDiscountType || 'percentage');
            setDiscountLocked(!canOverrideDiscount);
        } else {
            setDiscount(0);
            setDiscountType('percentage');
            setDiscountLocked(false);
        }`;
c = c.replace(oldHandleClientChange, newHandleClientChange);

// 5. handleItemClick liveRate
c = c.replace(
    `const liveRate = +(rate - (rate * appliedDiscount / 100)).toFixed(2);`,
    `const liveRate = discountType === 'amount' ? +(rate - appliedDiscount).toFixed(2) : +(rate - (rate * appliedDiscount / 100)).toFixed(2);`
);

// 6. global liveRate
c = c.replace(
    `const liveRate = +(currentRate - (currentRate * appliedDiscount / 100)).toFixed(2);`,
    `const liveRate = discountType === 'amount' ? +(currentRate - appliedDiscount).toFixed(2) : +(currentRate - (currentRate * appliedDiscount / 100)).toFixed(2);`
);

// 7. Retrospective calculation
c = c.replace(
    `const newRate = +(item.baseRate - (item.baseRate * applied / 100)).toFixed(2);`,
    `const newRate = discountType === 'amount' ? +(item.baseRate - applied).toFixed(2) : +(item.baseRate - (item.baseRate * applied / 100)).toFixed(2);`
);

// 8. UI Strip
const oldUI = `<div className="discount-group">
                                    <input type="number" min="0" max="100" step="0.5"
                                        value={discount}
                                        onChange={e => !discountLocked && setDiscount(e.target.value)}
                                        readOnly={discountLocked}
                                        style={discountLocked ? { background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.35)', width: '55px' } : { width: '55px' }}
                                    />
                                    <span className="pct">%</span>
                                </div>`;
const newUI = `<div className="discount-group" style={{ display: 'flex', gap: '4px' }}>
                                    <input type="number" min="0" step="0.5"
                                        value={discount}
                                        onChange={e => !discountLocked && setDiscount(e.target.value)}
                                        readOnly={discountLocked}
                                        style={discountLocked ? { background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.35)', width: '55px' } : { width: '55px' }}
                                    />
                                    <select
                                        value={discountType}
                                        onChange={e => !discountLocked && setDiscountType(e.target.value)}
                                        disabled={discountLocked}
                                        style={{ padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)' }}
                                    >
                                        <option value="percentage">%</option>
                                        <option value="amount">₹</option>
                                    </select>
                                </div>`;

c = c.replace(oldUI, newUI);

fs.writeFileSync(file, c);
console.log('Modified PoultryPOS.jsx successfully!');
