import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import app from '../src/index';
import type {
  BillExtractionResponse,
  NormalizationResponse
} from '../../shared/types';

interface VoiceCorrectionResponse {
  bill: BillExtractionResponse;
  corrections: Array<{
    field: string;
    itemId?: string;
    originalValue: string | null;
    correctedValue: string;
  }>;
  readBack: string;
  warnings: string[];
}

interface VocabularyEntry {
  id: string;
  spokenOrWrittenTerm: string;
  canonicalValue: string;
  valueType: string;
  confirmedByUser: boolean;
}

let server: Server;
let baseUrl = '';

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === 'object', 'server should expose a port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('BahiVerse demo flow', async (t) => {
  let uploadedBill: BillExtractionResponse | null = null;

  await t.test('1. health check returns ok', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);

    const body = (await response.json()) as { status: string; service: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'BahiVerse Backend');
  });

  await t.test('2. upload returns a needs_review BillExtractionResponse', async () => {
    const form = new FormData();
    form.append(
      'bill',
      new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
        type: 'image/png'
      }),
      'mock-bill.png'
    );
    form.append('language', 'pa');

    const response = await fetch(`${baseUrl}/api/bills/upload`, {
      method: 'POST',
      body: form
    });
    assert.equal(response.status, 200);

    const body = (await response.json()) as BillExtractionResponse;
    assert.equal(body.status, 'needs_review');
    assert.equal(body.language, 'pa');
    assert.ok(body.billId.startsWith('bill-'));
    assert.ok(Array.isArray(body.items) && body.items.length > 0);
    assert.ok(Array.isArray(body.warnings));
    assert.ok(body.fields.billNumber);
    assert.ok(body.fields.billDate);
    assert.ok(body.fields.customerName);
    assert.equal(typeof body.fields.grandTotal.value, 'number');

    uploadedBill = body;
  });

  await t.test(
    '3. voice quantity correction updates quantity, line total and grand total',
    async () => {
      assert.ok(uploadedBill, 'upload test must run first');

      const response = await fetch(
        `${baseUrl}/api/bills/${uploadedBill.billId}/corrections/voice`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ transcript: 'Change quantity to 8' })
        }
      );
      assert.equal(response.status, 200);

      const body = (await response.json()) as VoiceCorrectionResponse;
      const item = body.bill.items[0];
      assert.equal(item.quantity, 8);
      assert.equal(item.lineTotal, 336);
      assert.equal(body.bill.fields.grandTotal.value, item.lineTotal);
      assert.ok(body.corrections.some((correction) => correction.field.includes('quantity')));
      assert.ok(body.readBack.length > 0);
      assert.ok(body.bill.warnings.length >= 0);
    }
  );

  await t.test('4. customer voice correction updates the customer name', async () => {
    assert.ok(uploadedBill, 'upload test must run first');

    const response = await fetch(
      `${baseUrl}/api/bills/${uploadedBill.billId}/corrections/voice`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript: 'Customer name is Ravi' })
      }
    );
    assert.equal(response.status, 200);

    const body = (await response.json()) as VoiceCorrectionResponse;
    assert.equal(body.bill.fields.customerName.value, 'Ravi');
    assert.equal(body.bill.fields.customerName.reviewStatus, 'corrected');
    assert.ok(
      body.corrections.some((correction) => correction.field === 'fields.customerName')
    );
  });

  await t.test('5. vocabulary resolves "peti" to "Box"', async () => {
    const listResponse = await fetch(`${baseUrl}/api/vocabulary`);
    assert.equal(listResponse.status, 200);

    const entries = (await listResponse.json()) as VocabularyEntry[];
    const peti = entries.find((entry) => entry.spokenOrWrittenTerm === 'peti');
    assert.ok(peti, 'default peti mapping should exist');
    assert.equal(peti?.canonicalValue, 'Box');
    assert.equal(peti?.confirmedByUser, true);

    const postResponse = await fetch(`${baseUrl}/api/vocabulary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        spokenOrWrittenTerm: 'peti',
        canonicalValue: 'Box',
        valueType: 'unit'
      })
    });
    assert.equal(postResponse.status, 201);

    const confirmed = (await postResponse.json()) as VocabularyEntry;
    assert.equal(confirmed.canonicalValue, 'Box');
    assert.equal(confirmed.confirmedByUser, true);
  });

  await t.test('6. normalization returns four relational tables', async () => {
    assert.ok(uploadedBill, 'upload test must run first');

    const response = await fetch(
      `${baseUrl}/api/bills/${uploadedBill.billId}/normalization`
    );
    assert.equal(response.status, 200);

    const body = (await response.json()) as NormalizationResponse;
    const names = body.tables.map((table) => table.name).sort();
    assert.deepEqual(names, ['BillItems', 'Bills', 'Customers', 'Products']);
    assert.equal(body.relationships.length, 3);
    assert.ok(body.dependencies.length >= 1);
  });
});
