import { ProductCategory } from '@vton/shared';

export interface CategoryClassificationResult {
  category: ProductCategory;
  confidence: number;
  matchedKeyword?: string;
}

interface TaxonomyRule {
  category: ProductCategory;
  regex: RegExp;
  weight: number;
}

const TAXONOMY_RULES: TaxonomyRule[] = [
  // Specific categories evaluated before broader ones (e.g. Necklaces before Jewellery, Dresses before Tops)
  {
    category: ProductCategory.NECKLACES,
    regex: /\b(necklace|necklaces|pendant|pendants|choker|chokers|chain|chains|locket|lockets)\b/i,
    weight: 0.95,
  },
  {
    category: ProductCategory.JEWELLERY,
    regex: /\b(jewellery|jewelry|earring|earrings|ring|rings|bracelet|bracelets|bangle|bangles|brooch)\b/i,
    weight: 0.9,
  },
  {
    category: ProductCategory.ACCESSORIES,
    regex: /\b(scarf|scarves|belt|belts|hat|hats|cap|caps|beanie|beanies|bag|bags|handbag|handbags|tote|totes|purse|clutch|wallet|sunglasses|eyewear|watch|watches)\b/i,
    weight: 0.9,
  },
  {
    category: ProductCategory.DRESSES,
    regex: /\b(dress|dresses)\b(?!\s+(belt|shirt|shoe|boot|trouser|pant))\b|(?:\b(gown|gowns|frock|frocks|maxi|midi|mini dress|jumpsuit|jumpsuits|romper|rompers)\b)/i,
    weight: 0.95,
  },
  {
    category: ProductCategory.JACKETS,
    regex: /\b(jacket|jackets|blazer|blazers|coat|coats|hoodie|hoodies|cardigan|cardigans|sweater|sweaters|parka|parkas|outerwear|vest|vests|windbreaker|bomber|puffer|trench)\b/i,
    weight: 0.92,
  },
  {
    category: ProductCategory.TOPS,
    regex: /\b(t-shirt|tshirt|t-shirts|tshirts|tee|tees|tank|tank top|crop top|camisole|cami|top|tops|halter|tunic)\b/i,
    weight: 0.9,
  },
  {
    category: ProductCategory.SHIRTS,
    regex: /\b(shirt|shirts|button-down|buttondown|oxford|flannel|blouse|blouses|polo|polos|formal shirt)\b/i,
    weight: 0.88,
  },
  {
    category: ProductCategory.PANTS,
    regex: /\b(pant|pants|trousers|trouser|jeans|jean|denim|chinos|chino|shorts|short|leggings|legging|joggers|jogger|sweatpants|tights|skirt|skirts|cargo)\b/i,
    weight: 0.9,
  },
  {
    category: ProductCategory.SHOES,
    regex: /\b(shoe|shoes|sneaker|sneakers|boot|boots|heel|heels|loafer|loafers|sandals|sandal|flats|flat|footwear|slippers|mule|mules|pumps|trainer|trainers)\b/i,
    weight: 0.95,
  },
];

export class CategoryClassifier {
  /**
   * Classify text against fashion taxonomy rules to infer ProductCategory.
   */
  static classify(text: string, altOrUrl?: string): CategoryClassificationResult {
    const combined = `${text} ${altOrUrl || ''}`.toLowerCase();

    for (const rule of TAXONOMY_RULES) {
      const match = combined.match(rule.regex);
      if (match) {
        return {
          category: rule.category,
          confidence: rule.weight,
          matchedKeyword: match[0],
        };
      }
    }

    // Default fallback when uncertain
    return {
      category: ProductCategory.CUSTOM,
      confidence: 0.2,
    };
  }
}
