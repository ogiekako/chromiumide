// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as api from '../../../../features/gerrit/api';

describe('accountName', () => {
  it('can use display_name', () => {
    expect(
      api.accountName({
        _account_id: 12345,
        display_name: 'John',
        name: 'John Smith',
      })
    ).toBe('John');
  });
  it('can use name', () => {
    expect(
      api.accountName({
        _account_id: 12345,
        name: 'John Smith',
      })
    ).toBe('John Smith');
  });
  it('can use _account_id: 12345', () => {
    expect(
      api.accountName({
        _account_id: 12345,
      })
    ).toBe('id12345');
  });
});
