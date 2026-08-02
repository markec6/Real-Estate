type ListingCardSkeletonProps = {
  count?: number
}

function SkeletonCard() {
  return (
    <div className="listing-card-skeleton" aria-hidden="true">
      <div className="dash-skeleton-block dash-skeleton-thumb" />
      <div className="dash-skeleton-lines">
        <div className="dash-skeleton-block dash-skeleton-line dash-skeleton-line-lg" />
        <div className="dash-skeleton-block dash-skeleton-line dash-skeleton-line-md" />
        <div className="dash-skeleton-block dash-skeleton-line dash-skeleton-line-sm" />
      </div>
    </div>
  )
}

export default function ListingCardSkeleton({ count = 3 }: ListingCardSkeletonProps) {
  return (
    <div className="property-sidebar-list" aria-label="Učitavanje oglasa" role="status">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  )
}
