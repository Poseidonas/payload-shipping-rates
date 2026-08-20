import type { Field } from 'payload'

import type { ResolvedConfig } from './types.js'

/**
 * The chosen method and its cost, recorded on an order or a cart.
 */
export const shippingSelectionField = (config: ResolvedConfig): Field => ({
  name: config.fieldName,
  type: 'group',
  fields: [
    { name: 'method', type: 'text', index: true, label: 'Method code' },
    { name: 'label', type: 'text', label: 'Method label' },
    { name: 'type', type: 'text', label: 'Method type' },
    { name: 'zone', type: 'text', label: 'Zone' },
    {
      name: 'amount',
      type: 'number',
      admin: { description: 'Cost in minor units, so 490 is 4.90.' },
      label: 'Shipping amount',
      min: 0,
    },
  ],
  label: 'Shipping',
})
