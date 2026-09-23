import { getCatalog } from "@/features/catalog/api/get-catalog";
import { CatalogView } from "@/features/catalog/ui/catalog-view";
import { catalogQuerySchema, type CatalogQuery } from "@/shared/api/contracts/task-match";

export const dynamic = "force-dynamic";

/** Некорректные параметры игнорируются по одному, остальные фильтры применяются. */
function parseFilters(raw: Record<string, string | string[] | undefined>): CatalogQuery {
  const filters: Record<string, string> = {};
  for (const key of Object.keys(catalogQuerySchema.shape) as (keyof CatalogQuery)[]) {
    const value = raw[key];
    if (typeof value !== "string") continue;
    if (catalogQuerySchema.shape[key].safeParse(value).success) filters[key] = value;
  }
  return catalogQuerySchema.parse(filters);
}

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const filters = parseFilters(await searchParams);
  const catalog = await getCatalog(filters);

  return (
    <main className="w-full">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 text-sm lg:px-8 lg:py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Все задачи</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Все опубликованные задачи: сначала с высоким рейтингом. Откликнуться можно на любую.
          </p>
        </header>
        <CatalogView initial={catalog} filters={filters} />
      </div>
    </main>
  );
}
