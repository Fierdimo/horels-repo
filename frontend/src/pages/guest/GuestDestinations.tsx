import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { MapPin, Search, Star, Users, Calendar, TrendingUp, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Destination {
  id: string;
  name: string;
  country: string;
  image: string;
  description: string;
  properties: number;
  rating: number;
  reviews: number;
  popular: boolean;
  bestTime: string;
}

export default function GuestDestinations() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'popular' | 'favorites'>('all');

  // Mock data - TODO: Replace with real API
  const destinations: Destination[] = [
    {
      id: '1',
      name: 'Barcelona',
      country: 'Spain',
      image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800',
      description: 'Vibrant coastal city with stunning architecture and beaches',
      properties: 24,
      rating: 4.8,
      reviews: 342,
      popular: true,
      bestTime: 'Apr - Oct',
    },
    {
      id: '2',
      name: 'Paris',
      country: 'France',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800',
      description: 'The city of lights with iconic landmarks and world-class culture',
      properties: 18,
      rating: 4.9,
      reviews: 528,
      popular: true,
      bestTime: 'May - Sep',
    },
    {
      id: '3',
      name: 'Rome',
      country: 'Italy',
      image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800',
      description: 'Ancient city with rich history and incredible cuisine',
      properties: 15,
      rating: 4.7,
      reviews: 289,
      popular: true,
      bestTime: 'Apr - Jun',
    },
    {
      id: '4',
      name: 'Amsterdam',
      country: 'Netherlands',
      image: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800',
      description: 'Charming canals, museums, and cycling culture',
      properties: 12,
      rating: 4.6,
      reviews: 198,
      popular: false,
      bestTime: 'Apr - Sep',
    },
    {
      id: '5',
      name: 'Vienna',
      country: 'Austria',
      image: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800',
      description: 'Imperial city with grand palaces and classical music heritage',
      properties: 9,
      rating: 4.7,
      reviews: 156,
      popular: false,
      bestTime: 'May - Sep',
    },
    {
      id: '6',
      name: 'Lisbon',
      country: 'Portugal',
      image: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=800',
      description: 'Hilly coastal city with historic trams and colorful tiles',
      properties: 11,
      rating: 4.8,
      reviews: 224,
      popular: true,
      bestTime: 'Mar - Oct',
    },
  ];

  const filteredDestinations = destinations.filter((dest) => {
    const matchesSearch =
      dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      selectedFilter === 'all' ||
      (selectedFilter === 'popular' && dest.popular) ||
      (selectedFilter === 'favorites' && false); // TODO: Implement favorites

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('guest.dashboard.destinations') || 'Destinations'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('guest.destinations.subtitle') || 'Explore our available locations worldwide'}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('guest.destinations.searchPlaceholder') || 'Search destinations...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedFilter === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('common.all') || 'All'}
              </button>
              <button
                onClick={() => setSelectedFilter('popular')}
                className={`px-4 py-2 rounded-lg font-medium transition inline-flex items-center gap-2 ${
                  selectedFilter === 'popular'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                {t('guest.destinations.popular') || 'Popular'}
              </button>
              <button
                onClick={() => setSelectedFilter('favorites')}
                className={`px-4 py-2 rounded-lg font-medium transition inline-flex items-center gap-2 ${
                  selectedFilter === 'favorites'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Heart className="h-4 w-4" />
                {t('guest.destinations.favorites') || 'Favorites'}
              </button>
            </div>
          </div>
        </div>

        {/* Destinations Grid */}
        {filteredDestinations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t('guest.destinations.noResults') || 'No destinations found'}
            </h3>
            <p className="text-gray-500">
              {t('guest.destinations.noResultsDesc') || 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDestinations.map((destination) => (
              <Link
                key={destination.id}
                to="/guest/marketplace"
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition group"
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={destination.image}
                    alt={destination.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {destination.popular && (
                    <div className="absolute top-4 right-4 bg-primary text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {t('guest.destinations.popular') || 'Popular'}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      // TODO: Implement favorite toggle
                    }}
                    className="absolute top-4 left-4 bg-white/90 hover:bg-white p-2 rounded-full transition"
                  >
                    <Heart className="h-4 w-4 text-gray-600" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary transition">
                        {destination.name}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {destination.country}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium text-gray-900">{destination.rating}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{destination.description}</p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {destination.properties} {t('guest.destinations.properties') || 'properties'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        {destination.reviews} {t('guest.destinations.reviews') || 'reviews'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t('guest.destinations.bestTime') || 'Best time'}: {destination.bestTime}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {filteredDestinations.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-primary to-blue-600 rounded-lg p-6 text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">{destinations.length}</div>
                <div className="text-sm text-white/80">
                  {t('guest.destinations.totalDestinations') || 'Total Destinations'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">
                  {destinations.reduce((sum, d) => sum + d.properties, 0)}
                </div>
                <div className="text-sm text-white/80">
                  {t('guest.destinations.totalProperties') || 'Total Properties'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">
                  {destinations.filter((d) => d.popular).length}
                </div>
                <div className="text-sm text-white/80">
                  {t('guest.destinations.popularDestinations') || 'Popular Destinations'}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
