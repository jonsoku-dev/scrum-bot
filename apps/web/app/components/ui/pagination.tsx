import { useSearchParams, Link } from "react-router";

interface PaginationProps {
  totalPages: number;
  className?: string;
}

export function Pagination({ totalPages, className = "" }: PaginationProps) {
  const [searchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;

  // Don't render if there's only one page (or less)
  if (totalPages <= 1) return null;

  const getPageLink = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `?${params.toString()}`;
  };

  return (
    <div className={`flex items-center justify-center gap-4 mt-8 ${className}`}>
      {/* Previous Button */}
      {currentPage > 1 ? (
        <Link
          to={getPageLink(currentPage - 1)}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
        >
          ← Previous
        </Link>
      ) : (
        <span className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-900 border border-gray-800 rounded-lg cursor-not-allowed">
          ← Previous
        </span>
      )}

      <span className="text-sm text-gray-400">
        Page <span className="font-medium text-white">{currentPage}</span> of{" "}
        <span className="font-medium text-white">{totalPages}</span>
      </span>

      {/* Next Button */}
      {currentPage < totalPages ? (
        <Link
          to={getPageLink(currentPage + 1)}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
        >
          Next →
        </Link>
      ) : (
        <span className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-900 border border-gray-800 rounded-lg cursor-not-allowed">
          Next →
        </span>
      )}
    </div>
  );
}
