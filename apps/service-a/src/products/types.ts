export interface TFilterQuery {
  $text?: { $search: string };
  category?: string;
  brand?: string;
  price?: {
    $gte?: number;
    $lte?: number;
  };
}
