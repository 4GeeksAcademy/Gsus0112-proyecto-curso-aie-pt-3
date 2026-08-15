export function findCarrierByIdLinear(carriers, targetId) {
    if (carriers.length === 0) {
        return null;
    }
    for (let i = 0; i < carriers.length; i += 1) {
        const carrier = carriers[i];
        if (carrier.id === targetId) {
            return carrier;
        }
    }
    return null;
}
export function findReturnByIdBinary(sortedReturns, targetId) {
    if (sortedReturns.length === 0) {
        return null;
    }
    let left = 0;
    let right = sortedReturns.length - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const item = sortedReturns[mid];
        const currentId = item.id;
        if (currentId === targetId) {
            return item;
        }
        if (currentId < targetId) {
            left = mid + 1;
        }
        else {
            right = mid - 1;
        }
    }
    return null;
}
//# sourceMappingURL=search.js.map