import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MapPin, Calendar, Users, DoorOpen, Phone, Clock, Loader, QrCode, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import QRCode from 'qrcode.react';

interface BookingDetail {
  id: number;
  property: {
    name: string;
    location: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  checkIn: string;
  checkOut: string;
  roomType: string;
  status: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
}

export default function BookingDetails() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingToken = searchParams.get('token');

  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  // Fetch booking details
  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingToken) {
        setError('Booking token not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(`/api/hotels/guest/booking/${bookingToken}`);
        setBooking(response.data.booking);
        // Check if already checked in (would need to be stored in state or localStorage)
        const storedCheckIn = localStorage.getItem(`checkin-${bookingToken}`);
        if (storedCheckIn) {
          setCheckedIn(true);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load booking details');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingToken]);

  const handleCheckIn = () => {
    localStorage.setItem(`checkin-${bookingToken}`, 'true');
    setCheckedIn(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateNights = () => {
    if (!booking) return 0;
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    return Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-lg font-semibold">Access Error</h2>
            </div>
            <p className="text-gray-600 mb-4">{error || 'Booking not found'}</p>
            <button
              onClick={() => navigate('/')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Booking</h1>
              <p className="text-gray-600 mt-1">Booking #{booking.id}</p>
            </div>
            <div className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 ${
              booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
              booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              <CheckCircle className="h-5 w-5" />
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Property Info Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Property Information</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <DoorOpen className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Property Name</p>
                    <p className="text-lg font-semibold text-gray-900">{booking.property.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {booking.property.city && booking.property.country
                        ? `${booking.property.city}, ${booking.property.country}`
                        : booking.property.location || 'N/A'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DoorOpen className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-600">Room Type</p>
                    <p className="text-lg font-semibold text-gray-900">{booking.roomType || 'Standard'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stay Details Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Stay Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Check-in</p>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">{formatDate(booking.checkIn).split(' ').slice(0, 3).join(' ')}</p>
                      <p className="text-sm text-gray-600">{formatDate(booking.checkIn).split(' ').slice(3).join(' ')}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Check-out</p>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-5 w-5 text-purple-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900">{formatDate(booking.checkOut).split(' ').slice(0, 3).join(' ')}</p>
                      <p className="text-sm text-gray-600">{formatDate(booking.checkOut).split(' ').slice(3).join(' ')}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center gap-3">
                <Clock className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Duration</p>
                  <p className="font-semibold text-gray-900">{calculateNights()} night{calculateNights() !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Guest Information Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Guest Information</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-600">Guest Name</p>
                    <p className="font-semibold text-gray-900">{booking.guest_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span>📧</span>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-semibold text-gray-900">{booking.guest_email}</p>
                  </div>
                </div>
                {booking.guest_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-semibold text-gray-900">{booking.guest_phone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Check-in Card */}
            <div className={`${checkedIn ? 'bg-green-50 border-2 border-green-200' : 'bg-blue-50 border-2 border-blue-200'} rounded-lg p-6`}>
              <div className="text-center">
                {checkedIn ? (
                  <>
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-700 mb-2">Checked In</h3>
                    <p className="text-sm text-green-600">You have successfully checked in</p>
                  </>
                ) : (
                  <>
                    <QrCode className="h-12 w-12 text-blue-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-blue-700 mb-2">Digital Check-in</h3>
                    <button
                      onClick={() => setShowQR(!showQR)}
                      className="w-full mt-3 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition font-medium"
                    >
                      {showQR ? 'Hide QR Code' : 'Show QR Code'}
                    </button>
                    <button
                      onClick={handleCheckIn}
                      className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition font-medium"
                    >
                      Check In Now
                    </button>
                  </>
                )}
              </div>

              {/* QR Code */}
              {showQR && !checkedIn && (
                <div className="mt-4 p-4 bg-white rounded-lg flex flex-col items-center">
                  <QRCode
                    value={bookingToken || ''}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Scan this code at the reception desk or show it on your phone
                  </p>
                </div>
              )}
            </div>

            {/* Actions Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => navigate(`/guest/services?token=${bookingToken}`)}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-gray-900 font-medium"
                >
                  🛎️ Request Service
                </button>
                <button
                  onClick={() => window.location.href = `tel:+1234567890`}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-gray-900 font-medium"
                >
                  📞 Contact Property
                </button>
                <button
                  onClick={() => alert('Feedback system coming soon')}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-gray-900 font-medium"
                >
                  ⭐ Leave Feedback
                </button>
              </div>
            </div>

            {/* Important Info Card */}
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-700 mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Important
              </h4>
              <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
                <li>Check-in time: 3:00 PM</li>
                <li>Check-out time: 11:00 AM</li>
                <li>Key pickup at front desk</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
