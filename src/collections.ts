import type { CollectionConfig, Field } from 'payload'

import type { ResolvedConfig } from './types.js'

const bandsField = (config: ResolvedConfig): Field => ({
  name: 'bands',
  type: 'array',
  admin: {
    condition: (_, siblingData) =>
      siblingData?.type === 'weight_bands' || siblingData?.type === 'price_bands',
    description: `From is inclusive, to is exclusive. Leave to empty for the last band. Weight bands are written in ${config.weightUnit}, price bands in minor units. Amounts are always minor units.`,
  },
  fields: [
    { name: 'from', type: 'number', defaultValue: 0, label: 'From', min: 0, required: true },
    { name: 'to', type: 'number', label: 'To', min: 0 },
    { name: 'amount', type: 'number', label: 'Amount', min: 0, required: true },
  ],
  label: 'Bands',
  labels: { plural: 'Bands', singular: 'Band' },
})

const methodsField = (config: ResolvedConfig): Field => ({
  name: 'methods',
  type: 'array',
  fields: [
    { name: 'label', type: 'text', label: 'Label', required: true },
    {
      name: 'code',
      type: 'text',
      admin: { description: 'Left empty, the label is used.' },
      label: 'Code',
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'flat',
      label: 'Type',
      options: [
        { label: 'Flat rate', value: 'flat' },
        { label: 'Free over a threshold', value: 'free_over' },
        { label: 'Weight bands', value: 'weight_bands' },
        { label: 'Price bands', value: 'price_bands' },
        { label: 'Local pickup', value: 'local_pickup' },
      ],
      required: true,
    },
    {
      name: 'amount',
      type: 'number',
      admin: {
        condition: (_, siblingData) =>
          siblingData?.type === 'flat' || siblingData?.type === 'local_pickup',
        description: 'Cost in minor units, so 490 is 4.90.',
      },
      label: 'Amount',
      min: 0,
    },
    {
      name: 'threshold',
      type: 'number',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'free_over',
        description:
          'Subtotal in minor units at which shipping becomes free. Below it the method is withdrawn.',
      },
      label: 'Threshold',
      min: 0,
    },
    bandsField(config),
    {
      name: 'excludedShippingClasses',
      type: 'text',
      admin: {
        description:
          'Shipping class slugs this method refuses. Leave empty when shipping classes are not in use.',
      },
      hasMany: true,
      label: 'Excluded shipping classes',
    },
  ],
  label: 'Methods',
  labels: { plural: 'Methods', singular: 'Method' },
})

export const shippingZonesCollection = (config: ResolvedConfig): CollectionConfig => ({
  slug: config.zonesSlug,
  access: {
    create: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
    read: () => true,
    update: ({ req }) => Boolean(req.user),
  },
  admin: {
    defaultColumns: ['name', 'priority'],
    group: 'Ecommerce',
    useAsTitle: 'name',
  },
  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true },
    {
      name: 'countries',
      type: 'text',
      admin: { description: 'Two letter country codes, or * for every country.' },
      hasMany: true,
      label: 'Countries',
      required: true,
    },
    {
      name: 'postcodes',
      type: 'text',
      admin: {
        description:
          'Exact postcodes, prefixes such as SW1*, or numeric ranges such as 1000...1999. Empty covers every postcode in the listed countries.',
      },
      hasMany: true,
      label: 'Postcodes',
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 0,
      index: true,
      label: 'Priority',
    },
    methodsField(config),
  ],
  labels: { plural: 'Shipping zones', singular: 'Shipping zone' },
  ...config.zonesOverrides,
})
