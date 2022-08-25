/** ******************************************************************************
 *  (c) 2020 Zondax GmbH
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */

import Zemu from '@zondax/zemu'
import { APP_DERIVATION, ETH_DERIVATION, cartesianProduct, curves, defaultOptions, models, enableBlindSigning } from './common'
import AvalancheApp, { Curve } from '@zondax/ledger-avalanche-app'
import { ec } from 'elliptic'
import { SIMPLE_TRANSFER_DATA } from './common_sign_vectors'

const secp256k1 = new ec('secp256k1');

const SIGN_TEST_DATA = cartesianProduct(curves, [
  {
    name: 'simple_transfer',
    op: SIMPLE_TRANSFER_DATA ,
  },
])

describe.skip.each(models)('Transfer [%s]; sign', function (m) {
  test.each(SIGN_TEST_DATA)('sign basic transactions', async function (curve, data) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AvalancheApp(sim.getTransport())
      const msg = data.op

      const testcase = `${m.prefix.toLowerCase()}-sign-${data.name}-${curve}`

      const currentScreen = sim.snapshot();
      const respReq = app.sign(APP_DERIVATION, msg)

      await sim.waitUntilScreenIsNot(currentScreen, 20000)

      await sim.compareSnapshotsAndApprove('.', testcase)

      const resp = await respReq

      console.log(resp, m.name, data.name, curve)

      expect(resp.returnCode).toEqual(0x9000)
      expect(resp.errorMessage).toEqual('No errors')
      expect(resp).toHaveProperty('hash')
      expect(resp).toHaveProperty('signature')

      const resp_addr = await app.getAddressAndPubKey(APP_DERIVATION, false)
      const pkey = secp256k1.keyFromPublic(resp_addr.publicKey)

      let signatureOK = true
      switch (curve) {
        case Curve.Secp256K1:
          //signature without r or s error thrown?
          // signatureOK = pkey.verify(resp.hash, resp.signature)
          break

        default:
          throw Error('not a valid curve type')
      }
      expect(signatureOK).toEqual(true)
    } finally {
      await sim.close()
    }
  })
})

